import { prisma } from "../lib/prisma.js";
import { config } from "../lib/env.js";
import { emitToBooking, emitToOperator } from "../lib/socket.js";
import { findEligibleOperators } from "./matching.js";
import { computeFare, computeEtaMinutes } from "./pricing.js";
import { getPlatformFeeSetting } from "./settings.js";
import { BOOKING_STATUS, OFFER_STATUS, BOOKING_STATUS_PROGRESSION } from "../lib/constants.js";
import { HttpError } from "../middleware/errorHandler.js";

// In-memory timers, keyed by BookingOffer.id. BookingOffer.expiresAt is the
// persisted source of truth — these are just what actually fires the
// transition; recoverPendingOffers() rebuilds this map from the DB at boot,
// and sweepExpiredOffers() is a periodic safety net in case an individual
// timer is lost (e.g. an ungraceful crash).
const timers = new Map();

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

  emitToOperator(candidate.operator.id, "offer:created", {
    bookingId: booking.id,
    offerId: offer.id,
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
  const candidates = await findEligibleOperators({
    pickupLat: booking.pickupLat,
    pickupLng: booking.pickupLng,
    excludeOperatorIds: triedOperatorIds,
  });

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
    return expired;
  }

  const { booking: updated } = await offerToOperator(booking, candidates[0], triedOperatorIds.length + 1);
  return updated;
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
}) {
  const booking = await prisma.booking.create({
    data: {
      userId,
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

  const candidates = await findEligibleOperators({
    pickupLat: pickup.lat,
    pickupLng: pickup.lng,
    excludeOperatorIds: [],
  });

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
  }, config.offerSweepIntervalSeconds * 1000);
}
