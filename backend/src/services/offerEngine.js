import { prisma } from "../lib/prisma.js";
import { config } from "../lib/env.js";
import { emitToBooking, emitToOperator } from "../lib/socket.js";
import { findEligibleOperators } from "./matching.js";
import { computeFare, computeEtaMinutes } from "./pricing.js";
import { getPlatformFeeSetting, getOfferTimeoutSeconds } from "./settings.js";
import { BOOKING_STATUS, OFFER_STATUS, BOOKING_STATUS_PROGRESSION } from "../lib/constants.js";
import { pushToUser, pushToOperator } from "./push.js";
import {
  chargeServiceFee,
  creditTripEarning,
  canCoverFee,
  applyWalletTransaction,
  WALLET_TX_TYPE,
  isDuplicateMovement,
} from "./wallet.js";
import { refundBookingPayment, checkPaymentRefStatus } from "./payment.js";
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
  // Prepaid (pay-first, 2026-08-04): the patient already paid a locked
  // price — every cascade offer carries it unchanged, and whoever accepts
  // earns that exact subtotal (a cheaper operator earns a little extra; a
  // pricier one is free to decline). Cash: fee setting fetched fresh per
  // offer so the fee active *at offer time* locks into serviceFee/total.
  const prepaid = !!booking.paidAt;
  let price;
  if (prepaid) {
    price = { subtotal: booking.subtotal, serviceFee: booking.serviceFee, total: booking.total };
  } else {
    const feeSetting = await getPlatformFeeSetting();
    price = computeFare({ operator: candidate.operator, distanceKm: booking.distanceKm, feeSetting });
  }
  // Admin-set accept window, read fresh per offer (BO change applies to the
  // next offer, never rewrites in-flight expiresAt).
  const timeoutSeconds = await getOfferTimeoutSeconds();
  const offeredAt = new Date();
  const expiresAt = new Date(offeredAt.getTime() + timeoutSeconds * 1000);

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
      // Prepaid price fields are locked — never rewritten by the cascade.
      ...(prepaid ? {} : { subtotal: price.subtotal, serviceFee: price.serviceFee, total: price.total }),
    },
  });

  await addTrackingEvent(booking.id, `Offer Sent to ${candidate.operator.name}`);
  scheduleOfferTimeout(offer.id, timeoutSeconds * 1000);

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
    body: `${booking.pickupName} → ${booking.destinationName} · RM ${price.subtotal.toFixed(0)} · ${timeoutSeconds}s to accept`,
    data: { kind: "offer", bookingId: booking.id, offerId: offer.id },
  });

  emitToOperator(candidate.operator.id, "offer:created", {
    bookingId: booking.id,
    offerId: offer.id,
    bookingType: booking.bookingType,
    scheduledAt: booking.scheduledAt,
    prepaid,
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
async function affordableCandidates(candidates, distanceKm, booking) {
  if (!candidates.length) return candidates;
  // Prepaid bookings: the fee comes out of the patient's payment, not the
  // operator's wallet — the wallet gate doesn't apply.
  if (booking?.paidAt) return candidates;
  const feeSetting = await getPlatformFeeSetting();
  return candidates.filter(({ operator }) =>
    canCoverFee(operator, computeFare({ operator, distanceKm, feeSetting }).serviceFee)
  );
}

// Refund a prepaid booking in full (no-operator expiry / cancellation).
// Idempotent via refundedAt; a failed provider refund is loudly logged for
// manual reconciliation — money must never silently vanish.
async function refundPrepaidBooking(booking, reason) {
  if (!booking.paidAt || booking.refundedAt) return;
  const result = await refundBookingPayment(booking);
  if (result.refunded) {
    await prisma.booking.update({
      where: { id: booking.id },
      data: { paymentStatus: "refunded", refundedAt: new Date() },
    });
    await addTrackingEvent(booking.id, "Payment Refunded In Full");
    pushToUser(booking.userId, {
      title: "Refund issued",
      body:
        reason === "cancelled"
          ? `Your booking was cancelled — RM ${booking.total?.toFixed(2)} has been refunded to your payment method.`
          : `No operator could take your trip — RM ${booking.total?.toFixed(2)} has been refunded. Call 999 if urgent.`,
      data: { kind: "refund", bookingId: booking.id },
    });
  } else {
    console.error(
      `REFUND REQUIRED for booking ${booking.id} (${result.reason}) — process manually via the ${booking.paymentProvider || "payment"} provider's dashboard/portal`
    );
    await addTrackingEvent(booking.id, "Refund Being Processed — Contact Support If Not Received");
  }
}

// On decline/timeout/skip: mark the transient "declined" pulse, then offer
// the next nearest untried operator, or expire the booking (999 fallback)
// if none remain. `reason` is one of: operator_declined | timed_out | skipped.
export async function advanceToNextOperator(bookingId, reason) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId }, include: { offers: true } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");

  // CAS from OFFERED only — if the patient cancelled (and was refunded) or
  // the booking otherwise left the race while this decline/timeout was in
  // flight, stop the cascade instead of resurrecting a dead booking
  // (review finding 2026-08-06).
  const gate = await prisma.booking.updateMany({
    where: { id: bookingId, status: BOOKING_STATUS.OFFERED },
    data: { status: BOOKING_STATUS.DECLINED },
  });
  if (gate.count === 0) return booking;
  await addTrackingEvent(bookingId, "Operator Declined — Searching Next");
  emitToBooking(bookingId, "booking:status_changed", { bookingId, status: BOOKING_STATUS.DECLINED, reason });

  const triedOperatorIds = booking.offers.map((o) => o.operatorId);
  const candidates = await affordableCandidates(
    await findEligibleOperators({
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      excludeOperatorIds: triedOperatorIds,
    }),
    booking.distanceKm,
    booking
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
    await refundPrepaidBooking(expired, "no_operators");
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
  prepaid = false,
}) {
  // Pay-first: lock the chosen operator's price NOW (server-computed, never
  // trusted from the client) — this exact amount is what the patient pays
  // and what any cascade operator earns.
  let lockedPrice = null;
  if (prepaid) {
    const chosenOperator = await prisma.operator.findUnique({ where: { id: chosenOperatorId } });
    if (!chosenOperator) throw new HttpError(404, "not_found", "Chosen operator not found");
    const feeSetting = await getPlatformFeeSetting();
    lockedPrice = computeFare({ operator: chosenOperator, distanceKm, feeSetting });
  }

  const booking = await prisma.booking.create({
    data: {
      userId,
      bookingType,
      scheduledAt,
      preferredOperatorId: scheduledAt || prepaid ? chosenOperatorId : null,
      ...(lockedPrice
        ? { subtotal: lockedPrice.subtotal, serviceFee: lockedPrice.serviceFee, total: lockedPrice.total }
        : {}),
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
      status: prepaid ? BOOKING_STATUS.PENDING_PAYMENT : BOOKING_STATUS.REQUESTED,
    },
  });
  await addTrackingEvent(booking.id, "Booking Requested");

  // Prepaid: stop here — no operator sees this until the payment lands
  // (markBookingPaidAndDispatch picks it up from there).
  if (prepaid) {
    await addTrackingEvent(booking.id, "Awaiting Payment");
    return booking;
  }

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

  return dispatchImmediate(booking, chosenOperatorId);
}

// Immediate dispatch: chosen operator first, else nearest eligible; expire
// (and refund, if prepaid) when nobody can take it. Shared by the cash
// booking path and the paid-dispatch path.
async function dispatchImmediate(booking, chosenOperatorId = booking.preferredOperatorId) {
  const candidates = await affordableCandidates(
    await findEligibleOperators({
      pickupLat: booking.pickupLat,
      pickupLng: booking.pickupLng,
      excludeOperatorIds: [],
    }),
    booking.distanceKm,
    booking
  );

  const chosen = candidates.find((c) => c.operator.id === chosenOperatorId);
  const nextBest = chosen || candidates[0];

  if (!nextBest) {
    const expired = await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BOOKING_STATUS.EXPIRED },
    });
    await addTrackingEvent(booking.id, "No Operators Left — Call 999");
    emitToBooking(booking.id, "booking:status_changed", {
      bookingId: booking.id,
      status: BOOKING_STATUS.EXPIRED,
      reason: "no_operators_left",
    });
    await refundPrepaidBooking(expired, "no_operators");
    return expired;
  }

  const { booking: updated } = await offerToOperator(booking, nextBest, 1);
  return updated;
}

// The payment landed (instant linked-card charge or verified Checkout
// session) — record it and start the operator race. Idempotent on repeat
// confirms; money arriving for an already-dead booking is refunded in full.
export async function markBookingPaidAndDispatch(bookingId, paymentRef, provider) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.paidAt) return booking;

  // CAS from PENDING_PAYMENT — exactly one confirm wins; a concurrent
  // duplicate confirm falls through to the idempotent re-read below instead
  // of double-dispatching (review finding 2026-08-06). Provider is recorded
  // from the actual settlement source, never hardcoded.
  const gate = await prisma.booking.updateMany({
    where: { id: bookingId, status: BOOKING_STATUS.PENDING_PAYMENT },
    data: {
      paymentRef,
      paidAt: new Date(),
      paymentStatus: "paid",
      paymentProvider: provider,
      status: BOOKING_STATUS.REQUESTED,
    },
  });

  if (gate.count === 0) {
    const fresh = await prisma.booking.findUnique({ where: { id: bookingId } });
    if (fresh.paidAt) return fresh; // concurrent confirm won — idempotent
    // Money arrived for a booking that already died (payment-timeout cancel,
    // etc.): record the payment so the ref is never lost, then refund it.
    const stale = await prisma.booking.update({
      where: { id: bookingId },
      data: { paymentRef, paidAt: new Date(), paymentStatus: "paid", paymentProvider: provider },
    });
    await refundPrepaidBooking(stale, "cancelled");
    return stale;
  }

  const paid = await prisma.booking.findUnique({ where: { id: bookingId } });
  await addTrackingEvent(bookingId, "Payment Received");
  emitToBooking(bookingId, "booking:status_changed", {
    bookingId,
    status: BOOKING_STATUS.REQUESTED,
    reason: "paid",
  });

  if (paid.scheduledAt) {
    await addTrackingEvent(bookingId, "Scheduled — Operator Search Starts Closer to Pickup");
    const delay = new Date(paid.scheduledAt).getTime() - DISPATCH_LEAD_MS - Date.now();
    if (delay <= 0) return dispatchScheduledBooking(bookingId);
    scheduleDispatchTimer(bookingId, delay);
    return paid;
  }
  return dispatchImmediate(paid);
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
    booking.distanceKm,
    booking
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
    await refundPrepaidBooking(expired, "no_operators");
    return expired;
  }

  await addTrackingEvent(bookingId, "Scheduled Pickup Approaching — Finding Your Operator");
  const { booking: updated } = await offerToOperator(booking, nextBest, 1);
  return updated;
}

// Boot-time recovery for the settle crash window: a PaymentOrder that CAS'd
// to "paid" whose effect (dispatch / wallet credit) never landed because the
// process died in between. Re-running the effect is safe — the booking gate
// and the ledger's unique orderRef make both idempotent.
export async function recoverPaymentOrders() {
  const paid = await prisma.paymentOrder.findMany({ where: { status: "paid" } });
  let repaired = 0;
  for (const order of paid) {
    try {
      if (order.kind === "booking_payment" && order.bookingId) {
        const booking = await prisma.booking.findUnique({
          where: { id: order.bookingId },
          select: { paidAt: true },
        });
        if (booking && !booking.paidAt) {
          await markBookingPaidAndDispatch(order.bookingId, order.gatewayRef ? `fiuu:${order.gatewayRef}` : order.id, order.provider);
          repaired++;
        }
      } else if (order.kind === "wallet_topup" && order.operatorId) {
        const credited = await prisma.walletTransaction.findUnique({ where: { orderRef: order.id } });
        if (!credited) {
          try {
            await applyWalletTransaction({
              operatorId: order.operatorId,
              type: WALLET_TX_TYPE.TOPUP,
              amount: order.amountRm,
              orderRef: order.id,
              note: `Top-up (recovered at boot, order ${order.id})`,
            });
            repaired++;
          } catch (err) {
            if (!isDuplicateMovement(err)) throw err;
          }
        }
      }
    } catch (err) {
      console.error(`recoverPaymentOrders(${order.id}) failed — reconcile manually:`, err);
    }
  }
  if (repaired) console.log(`Recovered ${repaired} paid payment order(s) with missing effects`);
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

  // CAS the offer flip — a racing timeout/cancel loses cleanly.
  const offerGate = await prisma.bookingOffer.updateMany({
    where: { id: offerId, status: OFFER_STATUS.PENDING },
    data: { status: OFFER_STATUS.ACCEPTED, respondedAt: new Date() },
  });
  if (offerGate.count === 0) throw new HttpError(409, "offer_not_pending", "Offer already resolved");
  clearOfferTimeout(offerId);

  // CAS the booking too, keyed to THIS operator being the current one: a
  // cancelled/refunded or already-accepted booking can't be accepted
  // (review finding 2026-08-06 — accept validated only the offer before).
  const bookingGate = await prisma.booking.updateMany({
    where: {
      id: offer.bookingId,
      operatorId,
      status: { in: [BOOKING_STATUS.OFFERED, BOOKING_STATUS.DECLINED] },
    },
    data: { status: BOOKING_STATUS.ACCEPTED },
  });
  if (bookingGate.count === 0) {
    // Undo the offer flip so the ledger of offers reflects reality.
    await prisma.bookingOffer.update({
      where: { id: offerId },
      data: { status: OFFER_STATUS.CANCELLED },
    });
    throw new HttpError(409, "booking_unavailable", "This booking is no longer available");
  }
  const booking = await prisma.booking.findUnique({ where: { id: offer.bookingId } });
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

  const gate = await prisma.bookingOffer.updateMany({
    where: { id: offerId, status: OFFER_STATUS.PENDING },
    data: { status: OFFER_STATUS.DECLINED, respondedAt: new Date() },
  });
  if (gate.count === 0) throw new HttpError(409, "offer_not_pending", "Offer already resolved");
  clearOfferTimeout(offerId);
  return advanceToNextOperator(offer.bookingId, "operator_declined");
}

// Called by the timer or the sweep — guarded so a race with accept/decline
// (which already cleared the timer, but the sweep doesn't know that) is a
// harmless no-op rather than a double-transition.
export async function expireOffer(offerId) {
  const offer = await prisma.bookingOffer.findUnique({ where: { id: offerId } });
  if (!offer || offer.status !== OFFER_STATUS.PENDING) return;

  // CAS — the timer and the sweep (and a racing accept) can all fire for the
  // same offer; exactly one wins the flip and advances the cascade.
  const gate = await prisma.bookingOffer.updateMany({
    where: { id: offerId, status: OFFER_STATUS.PENDING },
    data: { status: OFFER_STATUS.TIMED_OUT, respondedAt: new Date() },
  });
  if (gate.count === 0) return;
  clearOfferTimeout(offerId);
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

  // CAS: only cancel from the status we validated. If completion (or another
  // cancel) won the race, bail with 409 — never refund a completed trip.
  const gate = await prisma.booking.updateMany({
    where: { id: bookingId, status: booking.status },
    data: { status: BOOKING_STATUS.CANCELLED },
  });
  if (gate.count === 0) {
    throw new HttpError(409, "not_cancellable", "Booking status changed — refresh to see the latest state");
  }
  const updated = await prisma.booking.findUnique({ where: { id: bookingId } });
  await addTrackingEvent(bookingId, "Cancelled");
  emitToBooking(bookingId, "booking:status_changed", { bookingId, status: BOOKING_STATUS.CANCELLED });
  // Prepaid cancellations refund in full (v1 policy — no cancellation fee;
  // revisit with operators before pilot if late cancels become a problem).
  await refundPrepaidBooking(updated, "cancelled");
  // Re-read so the response reflects refund fields written above.
  return prisma.booking.findUnique({ where: { id: bookingId } });
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

  // Compare-and-swap on the status we validated against — a concurrent
  // transition (double-tap, retry, racing cancel) loses cleanly with a 409
  // instead of double-settling (review finding 2026-08-06).
  const gate = await prisma.booking.updateMany({
    where: { id: bookingId, status: booking.status },
    data: { status: targetStatus },
  });
  if (gate.count === 0) {
    throw new HttpError(409, "invalid_transition", "Booking status changed concurrently — refresh and retry");
  }
  const updated = await prisma.booking.findUnique({ where: { id: bookingId } });
  await addTrackingEvent(bookingId, STATUS_LABELS[targetStatus] || targetStatus);
  emitToBooking(bookingId, "booking:status_changed", { bookingId, status: targetStatus });

  // Trip done → settle money. Never blocks completion; failures shout.
  if (targetStatus === BOOKING_STATUS.COMPLETED) {
    await settleCompletedBooking(updated).catch((err) =>
      console.error(`settleCompletedBooking(${bookingId}) FAILED — reconcile manually:`, err)
    );
  }
  return updated;
}

// Pay-first (2026-08-04): money was settled BEFORE dispatch for prepaid
// bookings. Two-line ledger (2026-08-05): credit the full fare, then deduct
// the fee as its own auditable row — net = subtotal. Cash trips keep the
// agent model: patient paid the crew, only the fee row hits the wallet.
async function settleCompletedBooking(booking) {
  if (booking.paidAt) {
    await creditTripEarning(booking);
  }
  await chargeServiceFee(booking);
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

    // Prepaid bookings whose payment never arrived: cancel after 15 minutes.
    // The cancel is a CAS on PENDING_PAYMENT so a payment landing mid-sweep
    // can never be clobbered (review finding 2026-08-06); an in-flight card
    // charge ("processing") is reconciled against the provider first; and
    // the cancelled row still runs the refund guard in case money was taken.
    const stale = await prisma.booking.findMany({
      where: {
        status: BOOKING_STATUS.PENDING_PAYMENT,
        createdAt: { lte: new Date(Date.now() - 15 * 60 * 1000) },
      },
    });
    for (const booking of stale) {
      try {
        // A stored paymentRef with no paidAt = a charge that was still
        // "processing" when created. Ask the provider before deciding.
        if (booking.paymentRef && !booking.paidAt) {
          const check = await checkPaymentRefStatus(booking.paymentRef);
          if (check.status === "succeeded") {
            await markBookingPaidAndDispatch(booking.id, booking.paymentRef, booking.paymentProvider || "stripe");
            continue;
          }
          if (check.status === "processing") continue; // decide next sweep
        }
        const gate = await prisma.booking.updateMany({
          where: { id: booking.id, status: BOOKING_STATUS.PENDING_PAYMENT },
          data: { status: BOOKING_STATUS.CANCELLED },
        });
        if (gate.count === 0) continue; // payment won the race — leave it be
        await addTrackingEvent(booking.id, "Payment Not Completed — Booking Cancelled");
        emitToBooking(booking.id, "booking:status_changed", {
          bookingId: booking.id,
          status: BOOKING_STATUS.CANCELLED,
          reason: "payment_timeout",
        });
        const cancelled = await prisma.booking.findUnique({ where: { id: booking.id } });
        await refundPrepaidBooking(cancelled, "cancelled"); // no-op unless money was taken
      } catch (err) {
        console.error(`sweep cancel unpaid(${booking.id}) failed:`, err);
      }
    }
  }, config.offerSweepIntervalSeconds * 1000);
}
