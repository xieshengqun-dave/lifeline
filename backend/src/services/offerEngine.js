import { prisma } from "../lib/prisma.js";
import { config } from "../lib/env.js";
import { emitToBooking, emitToOperator } from "../lib/socket.js";
import { findEligibleOperators } from "./matching.js";
import { computeFare, computeEtaMinutes } from "./pricing.js";
import { getPlatformFeeSetting } from "./settings.js";
import { BOOKING_STATUS, OFFER_STATUS, BOOKING_STATUS_PROGRESSION } from "../lib/constants.js";
import { pushToUser, pushToOperator } from "./push.js";
import { chargeServiceFee, canCoverFee } from "./wallet.js";
import { HttpError } from "../middleware/errorHandler.js";

// In-memory timers, keyed by BookingOffer.id. BookingOffer.expiresAt is the
// persisted source of truth — these are just what actually fires the
// transition; recoverPendingOffers() rebuilds this map from the DB at boot,
// and sweepExpiredOffers() is a periodic safety net in case an individual
// timer is lost (e.g. an ungraceful crash).
const timers = new Map();

// Scheduled bookings: the offer race starts this long before scheduledAt
// (locked decision 2026-07-27 — operators commit near pickup time, not at
// booking time). Same timer/recovery/sweep architecture as offers:
// Booking.scheduledAt is the persisted source of truth, these timers only
// fire the dispatch.
export const DISPATCH_LEAD_MS = 45 * 60 * 1000;
const dispatchTimers = new Map(); // bookingId -> timeout handle

function scheduleDispatchTimer(bookingId, ms) {
  clearDispatchTimer(bookingId);
  // setTimeout clamps >24.8-day delays; validation caps scheduling at 30
  // days, so re-arm via the sweep instead of one giant timer for far dates.
  if (ms > 2_000_000_000) return;
  const handle = setTimeout(() => {
    dispatchScheduledBooking(bookingId).catch((err) =>
      console.error(`dispatchScheduledBooking(${bookingId}) failed:`, err)
    );
  }, ms);
  dispatchTimers.set(bookingId, handle);
}

function clearDispatchTimer(bookingId) {
  const handle = dispatchTimers.get(bookingId);
  if (handle) {
    clearTimeout(handle);
    dispatchTimers.delete(bookingId);
  }
}

function scheduleOfferTimeout(offerId, ms) {
  clearOfferTimeout(offerId);
  const handle = setTimeout(() => {
    expireOffer(offerId).catch((err) => console.error(`expireOffer(${offerId}) failed:`, err));
  }, ms);
  timers.set(offerId, handle);
}

function clearOfferTimeout(offerId) {
  const handle = timers.get(offerId);
  if (handle) {
    clearTimeout(handle);
    timers.delete(offerId);
  }
}

export async function addTrackingEvent(bookingId, label, lat, lng) {
  const event = await prisma.trackingEvent.create({ data: { bookingId, label, lat, lng } });
  emitToBooking(bookingId, "tracking:event", { bookingId, event });
  return event;
}

// Creates the BookingOffer row for `candidate` against `booking`, updates the
// booking's current operator/status/price, schedules the timeout, and emits
// the relevant socket events. Shared by the initial booking creation and by
// advanceToNextOperator.
async function offerToOperator(booking, candidate, sequence) {
  // Fetched fresh per offer (not cached across the request) so the fee
  // active *at offer time* gets locked into Booking.serviceFee/total — immune
  // to a later admin change to the setting mid-trip.
  const feeSetting = await getPlatformFeeSetting();
  const price = computeFare({ operator: candidate.operator, distanceKm: booking.distanceKm, feeSetting });
  const offeredAt = new Date();
  const expiresAt = new Date(offeredAt.getTime() + config.offerTimeoutSeconds * 1000);

  const offer = await prisma.bookingOffer.create({
    data: {
      bookingId: booking.id,
      operatorId: candidate.operator.id,
      sequence,
      dispatchDistanceKm: candidate.dispatchDistanceKm,
      computedPrice: price.subtotal,
      offeredAt,
      expiresAt,
    },
  });

  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: {
      status: BOOKING_STATUS.OFFERED,
      operatorId: candidate.operator.id,
      subtotal: price.subtotal,
      serviceFee: price.serviceFee,
      total: price.total,
    },
  });

  await addTrackingEvent(booking.id, `Offer Sent to ${candidate.operator.name}`);
  scheduleOfferTimeout(offer.id, config.offerTimeoutSeconds * 1000);

  emitToBooking(booking.id, "booking:offer_operator", {
    bookingId: booking.id,
    operator: {
      id: candidate.operator.id,
      name: candidate.operator.name,
      baseFare: candidate.operator.baseFare,
      perKmRate: candidate.operator.perKmRate,
      dispatchDistanceKm: candidate.dispatchDistanceKm,
      etaMinutes: computeEtaMinutes(candidate.dispatchDistanceKm),
      price,
    },
    offeredAt,
    expiresAt,
  });

  // The socket only reaches an open app — the push reaches a closed one.
  // Critical for scheduled dispatches (fires ~45 min before pickup) and for
  // any operator who isn't staring at Incoming Requests.
  pushToOperator(candidate.operator.id, {
    title: booking.scheduledAt ? "Scheduled transport request" : "New ambulance request",
    body: `${booking.pickupName} → ${booking.destinationName} · RM ${price.subtotal.toFixed(0)} · ${config.offerTimeoutSeconds}s to accept`,
    data: { kind: "offer", bookingId: booking.id, offerId: offer.id },
  });

  emitToOperator(candidate.operator.id, "offer:created", {
    bookingId: booking.id,
    offerId: offer.id,
    bookingType: booking.bookingType,
    scheduledAt: booking.scheduledAt,
    sequence,
    dispatchDistanceKm: candidate.dispatchDistanceKm,
    price,
    patientSummary: {
      age: booking.patientAge,
      gender: booking.patientGender,
      consciousLevel: booking.consciousLevel,
      oxygen: booking.oxygen,
      ivTherapy: booking.ivTherapy,
    },
    offeredAt,
    expiresAt,
  });

  return { offer, booking: updated };
}

// Wallet gate (decided 2026-07-31): only operators whose wallet covers this
// job's service fee may receive it — the fee is deducted on completion and
// no debt accrues by design. Applied wherever a candidate list is chosen
// from (initial offer, cascade, scheduled dispatch); the patient-facing
// quote applies the same rule so patients never see un-offerable operators.
async function affordableCandidates(candidates, distanceKm) {
  if (!candidates.length) return candidates;
  const feeSetting = await getPlatformFeeSetting();
  return candidates.filter(({ operator }) =>
    canCoverFee(operator, computeFare({ operator, distanceKm, feeSetting }).serviceFee)
  );
}

// On decline/timeout/skip: mark the transient "declined" pulse, then offer
// the next nearest untried operator, or expire the booking (999 fallback)
// if none remain. `reason` is one of: operator_declined | timed_out | skipped.
export async function advanceToNextOperator(bookingId, reason) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { offers: true } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");

  await prisma.booking.update({ where: { id: bookingId }, data: { status: BOOKING_STATUS.DECLINED } });
  await addTrackingEvent(bookingId, "Operator Declined — Searching Next");
  emitToBooking(bookingId, "booking:status_changed", { bookingId, status: BOOKING_STATUS.DECLINED, reason });

  const triedOperatorIds = booking.offers.map((o) => o.operatorId);
  const candidates = await affordableCandidates(
    await findEligibleOperators({
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      excludeOperatorIds: triedOperatorIds,
    }),
    booking.distanceKm
  );

  if (candidates.length === 0) {
    const expired = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BOOKING_STATUS.EXPIRED },
    });
    await addTrackingEvent(bookingId, "No Operators Left — Call 999");
    emitToBooking(bookingId, "booking:status_changed", {
      bookingId,
      status: BOOKING_STATUS.EXPIRED,
      reason: "no_operators_left",
    });
    notifyScheduledExpiry(expired);
    return expired;
  }

  const { booking: updated } = await offerToOperator(booking, candidates[0], triedOperatorIds.length + 1);
  return updated;
}

// A scheduled booking that dies (no operators / everyone declined) fails
// ~45 min before pickup with nobody looking at the app — this push is the
// only way the patient finds out in time to call 999 or rearrange.
function notifyScheduledExpiry(booking) {
  if (!booking.scheduledAt) return;
  pushToUser(booking.userId, {
    title: "Could not find an ambulance",
    body: "No operator accepted your scheduled transport. Please call 999 if urgent, or open the app to book again.",
    data: { kind: "booking_expired", bookingId: booking.id },
  });
}

// Creates a booking and offers the patient's chosen operator first (falling
// back to the next-nearest eligible operator if the chosen one is no longer
// eligible — e.g. went offline between quote and book — or expiring
// immediately if none are eligible at all).
export async function createBookingWithFirstOffer({
  userId,
  chosenOperatorId,
  pickup,
  destination,
  distanceKm,
  patient,
  paymentMethod,
  bookingType,
  scheduledAt,
}) {
  const booking = await prisma.booking.create({
    data: {
      userId,
      bookingType,
      scheduledAt,
      preferredOperatorId: scheduledAt ? chosenOperatorId : null,
      pickupName: pickup.name,
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      destinationName: destination.name,
      destinationLat: destination.lat,
      destinationLng: destination.lng,
      distanceKm,
      patientAge: patient?.age,
      patientGender: patient?.gender,
      consciousLevel: patient?.consciousLevel,
      oxygen: !!patient?.oxygen,
      oxygenFlow: patient?.oxygenFlow,
      ivTherapy: !!patient?.ivTherapy,
      medication: patient?.medication,
      diagnosis: patient?.diagnosis,
      specialRequest: patient?.specialRequest,
      paymentMethod,
      status: BOOKING_STATUS.REQUESTED,
    },
  });
  await addTrackingEvent(booking.id, "Booking Requested");

  // Scheduled: no offer now — the race starts DISPATCH_LEAD_MS before
  // pickup (or immediately if we're already inside that window).
  if (scheduledAt) {
    await addTrackingEvent(booking.id, "Scheduled — Operator Search Starts Closer to Pickup");
    const delay = new Date(scheduledAt).getTime() - DISPATCH_LEAD_MS - Date.now();
    if (delay <= 0) {
      return dispatchScheduledBooking(booking.id);
    }
    scheduleDispatchTimer(booking.id, delay);
    return booking;
  }

  const candidates = await affordableCandidates(
    await findEligibleOperators({
      pickupLat: pickup.lat,
      pickupLng: pickup.lng,
      excludeOperatorIds: [],
    }),
    distanceKm
  );

  const chosen = candidates.find((c) => c.operator.id === chosenOperatorId);
  const nextBest = chosen || candidates[0];

  if (!nextBest) {
    const expired = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BOOKING_STATUS.EXPIRED },
    });
    await addTrackingEvent(booking.id, "No Operators Left — Call 999");
    return expired;
  }

  const { booking: updated } = await offerToOperator(booking, nextBest, 1);
  return updated;
}

// Fires when a scheduled booking enters its dispatch window: run the same
// preferred-operator-first offer race the immediate path uses. Guarded to be
// a no-op if the booking was cancelled or already dispatched (timer + sweep
// + boot recovery can all race harmlessly).
export async function dispatchScheduledBooking(bookingId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    include: { offers: true },
  });
  clearDispatchTimer(bookingId);
  if (!booking || booking.status !== BOOKING_STATUS.REQUESTED || !booking.scheduledAt) return booking;
  if (booking.offers.length > 0) return booking;

  const candidates = await affordableCandidates(
    await findEligibleOperators({
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      excludeOperatorIds: [],
    }),
    booking.distanceKm
  );
  const chosen = candidates.find((c) => c.operator.id === booking.preferredOperatorId);
  const nextBest = chosen || candidates[0];

  if (!nextBest) {
    const expired = await prisma.booking.update({
      where: { id: bookingId },
      data: { status: BOOKING_STATUS.EXPIRED },
    });
    await addTrackingEvent(bookingId, "No Operators Left — Call 999");
    emitToBooking(bookingId, "booking:status_changed", {
      bookingId,
      status: BOOKING_STATUS.EXPIRED,
      reason: "no_operators_left",
    });
    notifyScheduledExpiry(expired);
    return expired;
  }

  await addTrackingEvent(bookingId, "Scheduled Pickup Approaching — Finding Your Operator");
  const { booking: updated } = await offerToOperator(booking, nextBest, 1);
  return updated;
}

// Boot-time recovery for scheduled bookings that haven't been dispatched yet
// (mirrors recoverPendingOffers): dispatch overdue ones now, re-arm timers
// for the rest.
export async function recoverScheduledDispatches() {
  const pending = await prisma.booking.findMany({
    where: { scheduledAt: { not: null }, status: BOOKING_STATUS.REQUESTED, offers: { none: {} } },
  });
  const now = Date.now();
  for (const booking of pending) {
    const delay = new Date(booking.scheduledAt).getTime() - DISPATCH_LEAD_MS - now;
    if (delay <= 0) {
      await dispatchScheduledBooking(booking.id).catch((err) =>
        console.error(`recover dispatch(${booking.id}) failed:`, err)
      );
    } else {
      scheduleDispatchTimer(booking.id, delay);
    }
  }
  if (pending.length) console.log(`Recovered ${pending.length} scheduled dispatch(es)`);
}

async function loadPendingOffer(offerId) {
  const offer = await prisma.bookingOffer.findUnique({ where: { id: offerId } });
  if (!offer) throw new HttpError(404, "not_found", "Offer not found");
  return offer;
}

export async function acceptOffer(offerId, operatorId) {
  const offer = await loadPendingOffer(offerId);
  if (offer.operatorId !== operatorId) throw new HttpError(403, "forbidden", "Not your offer");
  if (offer.status !== OFFER_STATUS.PENDING) throw new HttpError(409, "offer_not_pending", "Offer already resolved");

  clearOfferTimeout(offerId);
  await prisma.bookingOffer.update({
    where: { id: offerId },
    data: { status: OFFER_STATUS.ACCEPTED, respondedAt: new Date() },
  });
  const booking = await prisma.booking.update({
    where: { id: offer.bookingId },
    data: { status: BOOKING_STATUS.ACCEPTED },
  });
  await addTrackingEvent(booking.id, "Accepted");
  emitToBooking(booking.id, "booking:status_changed", { bookingId: booking.id, status: BOOKING_STATUS.ACCEPTED });
  // Scheduled bookings: the patient isn't watching a Waiting screen when the
  // dispatch resolves — tell them their ride is locked in.
  if (booking.scheduledAt) {
    const when = new Date(booking.scheduledAt);
    pushToUser(booking.userId, {
      title: "Ambulance confirmed",
      body: `Your scheduled transport is confirmed for ${when.toLocaleTimeString("en-MY", { hour: "2-digit", minute: "2-digit" })}. Track it in the Trips tab.`,
      data: { kind: "booking_accepted", bookingId: booking.id },
    });
  }
  return booking;
}

export async function declineOffer(offerId, operatorId) {
  const offer = await loadPendingOffer(offerId);
  if (offer.operatorId !== operatorId) throw new HttpError(403, "forbidden", "Not your offer");
  if (offer.status !== OFFER_STATUS.PENDING) throw new HttpError(409, "offer_not_pending", "Offer already resolved");

  clearOfferTimeout(offerId);
  await prisma.bookingOffer.update({
    where: { id: offerId },
    data: { status: OFFER_STATUS.DECLINED, respondedAt: new Date() },
  });
  return advanceToNextOperator(offer.bookingId, "operator_declined");
}

// Called by the timer or the sweep — guarded so a race with accept/decline
// (which already cleared the timer, but the sweep doesn't know that) is a
// harmless no-op rather than a double-transition.
export async function expireOffer(offerId) {
  const offer = await prisma.bookingOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.status !== OFFER_STATUS.PENDING) return;

  clearOfferTimeout(offerId);
  await prisma.bookingOffer.update({
    where: { id: offerId },
    data: { status: OFFER_STATUS.TIMED_OUT, respondedAt: new Date() },
  });
  return advanceToNextOperator(offer.bookingId, "timed_out");
}

export async function skipOffer(bookingId, userId) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.userId !== userId) throw new HttpError(403, "forbidden", "Not your booking");
  if (booking.status !== BOOKING_STATUS.OFFERED) {
    throw new HttpError(409, "not_offered", "Booking has no active offer to skip");
  }

  const pending = await prisma.bookingOffer.findFirst({
    where: { bookingId, operatorId: booking.operatorId, status: OFFER_STATUS.PENDING },
  });
  if (pending) {
    clearOfferTimeout(pending.id);
    await prisma.bookingOffer.update({
      where: { id: pending.id },
      data: { status: OFFER_STATUS.SKIPPED, respondedAt: new Date() },
    });
  }
  return advanceToNextOperator(bookingId, "skipped");
}

export async function cancelBooking(bookingId, userId) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.userId !== userId) throw new HttpError(403, "forbidden", "Not your booking");
  if ([BOOKING_STATUS.COMPLETED, BOOKING_STATUS.CANCELLED, BOOKING_STATUS.EXPIRED].includes(booking.status)) {
    throw new HttpError(409, "not_cancellable", `Booking already ${booking.status}`);
  }

  const pending = await prisma.bookingOffer.findFirst({
    where: { bookingId, status: OFFER_STATUS.PENDING },
  });
  if (pending) {
    clearOfferTimeout(pending.id);
    await prisma.bookingOffer.update({
      where: { id: pending.id },
      data: { status: OFFER_STATUS.CANCELLED, respondedAt: new Date() },
    });
  }
  // Scheduled booking cancelled before dispatch — stop the pending dispatch.
  clearDispatchTimer(bookingId);

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { status: BOOKING_STATUS.CANCELLED },
  });
  await addTrackingEvent(bookingId, "Cancelled");
  emitToBooking(bookingId, "booking:status_changed", { bookingId, status: BOOKING_STATUS.CANCELLED });
  return updated;
}

const STATUS_LABELS = {
  [BOOKING_STATUS.ENROUTE]: "En Route",
  [BOOKING_STATUS.ARRIVED]: "Arrived",
  [BOOKING_STATUS.ONBOARD]: "Patient Onboard",
  [BOOKING_STATUS.COMPLETED]: "Completed",
};

// Operator advances trip status. Allowed if `targetStatus` is strictly later
// in BOOKING_STATUS_PROGRESSION than the booking's current status — lets an
// operator skip a missed step (e.g. forgot to tap "en route") but never move
// backward or repeat a step.
export async function advanceBookingStatus(bookingId, operatorId, targetStatus) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.operatorId !== operatorId) throw new HttpError(403, "forbidden", "Not your booking");

  const currentIndex = BOOKING_STATUS_PROGRESSION.indexOf(booking.status);
  const targetIndex = BOOKING_STATUS_PROGRESSION.indexOf(targetStatus);
  if (targetIndex === -1 || targetIndex <= currentIndex) {
    throw new HttpError(409, "invalid_transition", `Cannot move from ${booking.status} to ${targetStatus}`);
  }

  const updated = await prisma.booking.update({ where: { id: bookingId }, data: { status: targetStatus } });
  await addTrackingEvent(bookingId, STATUS_LABELS[targetStatus] || targetStatus);
  emitToBooking(bookingId, "booking:status_changed", { bookingId, status: targetStatus });

  // Trip done → platform fee comes out of the operator's wallet (cash-trip
  // model; the patient paid the crew directly). Idempotent per booking.
  if (targetStatus === BOOKING_STATUS.COMPLETED) {
    await chargeServiceFee(updated).catch((err) =>
      // Never block completion over the ledger — but shout, this is money.
      console.error(`chargeServiceFee(${bookingId}) FAILED — reconcile manually:`, err)
    );
  }
  return updated;
}

// Run once at boot, before the server starts accepting requests, so a
// restart doesn't lose in-flight offers: catch up any offer whose expiresAt
// already passed, and reschedule a timer for the remaining time otherwise.
export async function recoverPendingOffers() {
  const pending = await prisma.bookingOffer.findMany({ where: { status: OFFER_STATUS.PENDING } });
  const now = Date.now();
  for (const offer of pending) {
    const remaining = new Date(offer.expiresAt).getTime() - now;
    if (remaining <= 0) {
      await expireOffer(offer.id);
    } else {
      scheduleOfferTimeout(offer.id, remaining);
    }
  }
  if (pending.length) console.log(`Recovered ${pending.length} pending offer(s)`);
}

// Belt-and-suspenders: catches any offer whose individual setTimeout was
// lost (e.g. an ungraceful crash between events). Bounded slop against the
// timeout window is ~config.offerSweepIntervalSeconds.
export function startOfferSweep() {
  return setInterval(async () => {
    const expired = await prisma.bookingOffer.findMany({
      where: { status: OFFER_STATUS.PENDING, expiresAt: { lte: new Date() } },
    });
    for (const offer of expired) {
      await expireOffer(offer.id).catch((err) => console.error(`sweep expireOffer(${offer.id}) failed:`, err));
    }

    // Scheduled bookings due for dispatch whose timer was lost (and the
    // re-arm path for >24.8-day timers setTimeout can't represent).
    const due = await prisma.booking.findMany({
      where: {
        status: BOOKING_STATUS.REQUESTED,
        scheduledAt: { not: null, lte: new Date(Date.now() + DISPATCH_LEAD_MS) },
        offers: { none: {} },
      },
    });
    for (const booking of due) {
      await dispatchScheduledBooking(booking.id).catch((err) =>
        console.error(`sweep dispatch(${booking.id}) failed:`, err)
      );
    }
  }, config.offerSweepIntervalSeconds * 1000);
}
