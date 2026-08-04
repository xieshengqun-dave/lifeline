import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requirePatientAuth, requireOperatorAuth } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { haversineKm } from "../lib/geo.js";
import { findEligibleOperators } from "../services/matching.js";
import { computeFare, computeEtaMinutes } from "../services/pricing.js";
import {
  createBookingWithFirstOffer,
  markBookingPaidAndDispatch,
  skipOffer,
  cancelBooking,
  advanceBookingStatus,
} from "../services/offerEngine.js";
import { paymentsEnabled, chargeBookingCard, createBookingPaymentSession } from "../services/payment.js";
import { assignBookingResources } from "../services/assignment.js";
import { getPlatformFeeSetting } from "../services/settings.js";
import { submitRating, getCompletedTripCounts } from "../services/rating.js";
import { canCoverFee } from "../services/wallet.js";
import { OFFER_STATUS } from "../lib/constants.js";

const router = Router();

const locationSchema = z.object({
  name: z.string().min(1),
  lat: z.number(),
  lng: z.number(),
});

const patientSchema = z
  .object({
    age: z.number().int().positive().optional(),
    gender: z.string().optional(),
    consciousLevel: z.string().optional(),
    oxygen: z.boolean().optional(),
    oxygenFlow: z.number().int().optional(),
    ivTherapy: z.boolean().optional(),
    medication: z.string().optional(),
    diagnosis: z.string().optional(),
    specialRequest: z.string().optional(),
  })
  .optional();

const quoteSchema = z.object({
  pickup: locationSchema,
  destination: locationSchema,
  patient: patientSchema,
});

const MIN_SCHEDULE_LEAD_MS = 15 * 60 * 1000; // closer than this → just book now
const MAX_SCHEDULE_AHEAD_MS = 30 * 24 * 60 * 60 * 1000;

const createBookingSchema = z.object({
  operatorId: z.string().min(1),
  pickup: locationSchema,
  destination: locationSchema,
  patient: patientSchema,
  // Pay-first (2026-08-04): cash dispatches immediately (emergencies only —
  // enforced in the handler when payments are configured); card charges the
  // linked card instantly; online returns a hosted-Checkout URL and the
  // booking waits in pending_payment until it's paid.
  paymentMethod: z.enum(["cash", "card", "online"]),
  bookingType: z.enum(["emergency", "transfer"]).default("emergency"),
  scheduledAt: z
    .string()
    .datetime({ offset: true })
    .optional()
    .refine((s) => !s || Date.parse(s) - Date.now() >= MIN_SCHEDULE_LEAD_MS, {
      message: "Scheduled time must be at least 15 minutes from now — book immediately instead",
    })
    .refine((s) => !s || Date.parse(s) - Date.now() <= MAX_SCHEDULE_AHEAD_MS, {
      message: "Scheduled time cannot be more than 30 days ahead",
    }),
});

const statusSchema = z.object({
  status: z.enum(["enroute", "arrived", "onboard", "completed"]),
});

const assignSchema = z
  .object({
    ambulanceId: z.string().min(1).optional(),
    crewIds: z.array(z.string().min(1)).min(1).optional(),
  })
  .refine((b) => b.ambulanceId || b.crewIds?.length, { message: "ambulanceId or crewIds is required" });

const ratingSchema = z.object({
  stars: z.number().int().min(1).max(5),
  comment: z.string().max(500).optional(),
});

async function requireOwnedBooking(bookingId, userId) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.userId !== userId) throw new HttpError(403, "forbidden", "Not your booking");
  return booking;
}

router.post(
  "/quote",
  requirePatientAuth,
  validate(quoteSchema),
  asyncHandler(async (req, res) => {
    const { pickup, destination } = req.body;
    const distanceKm = haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng);

    const [candidates, feeSetting] = await Promise.all([
      findEligibleOperators({ pickupLat: pickup.lat, pickupLng: pickup.lng }),
      getPlatformFeeSetting(),
    ]);
    // Same wallet gate the offer engine applies — patients never see an
    // operator who couldn't actually receive the job (see services/wallet.js).
    const offerable = candidates.filter(({ operator }) =>
      canCoverFee(operator, computeFare({ operator, distanceKm, feeSetting }).serviceFee)
    );
    const tripCounts = await getCompletedTripCounts(offerable.map((c) => c.operator.id));
    const operators = offerable.map(({ operator, dispatchDistanceKm }) => ({
      operatorId: operator.id,
      name: operator.name,
      fleetSummary: operator.fleetSummary,
      baseLat: operator.baseLat,
      baseLng: operator.baseLng,
      dispatchDistanceKm: Math.round(dispatchDistanceKm * 10) / 10,
      etaMinutes: computeEtaMinutes(dispatchDistanceKm),
      price: computeFare({ operator, distanceKm, feeSetting }),
      ratingAvg: operator.ratingAvg,
      ratingCount: operator.ratingCount,
      tripCount: tripCounts[operator.id] || 0,
    }));

    res.json({ distanceKm: Math.round(distanceKm * 10) / 10, operators });
  })
);

router.post(
  "/",
  requirePatientAuth,
  validate(createBookingSchema),
  asyncHandler(async (req, res) => {
    const { operatorId, pickup, destination, patient, paymentMethod, bookingType, scheduledAt } = req.body;
    const distanceKm = haversineKm(pickup.lat, pickup.lng, destination.lat, destination.lng);

    // Pay-first rules (2026-08-04). Cash = emergencies only — but ONLY
    // enforced when payments are configured; a dev/test server without a
    // Stripe key honestly can't take prepayment, so cash stays open there.
    const prepaid = paymentMethod !== "cash";
    if (prepaid && !paymentsEnabled()) {
      throw new HttpError(501, "payments_not_configured", "Online payment is not configured on this server");
    }
    if (paymentMethod === "cash" && bookingType !== "emergency" && paymentsEnabled()) {
      throw new HttpError(400, "cash_emergency_only", "Cash is only available for emergency bookings — transfers are paid in-app");
    }

    const booking = await createBookingWithFirstOffer({
      userId: req.userId,
      chosenOperatorId: operatorId,
      pickup,
      destination,
      distanceKm,
      patient,
      paymentMethod,
      bookingType,
      scheduledAt: scheduledAt ? new Date(scheduledAt) : null,
      prepaid,
    });

    // Prepaid: settle payment before anything is dispatched.
    let finalBooking = booking;
    let checkoutUrl = null;
    if (prepaid && booking.status === "pending_payment") {
      if (paymentMethod === "card") {
        const charge = await chargeBookingCard(booking);
        if (charge.charged) {
          finalBooking = await markBookingPaidAndDispatch(booking.id, charge.paymentIntentId);
        } else {
          // Linked card failed — hand back a checkout URL so the patient can
          // pay another way instead of dying here.
          ({ url: checkoutUrl } = await createBookingPaymentSession(booking));
        }
      } else {
        ({ url: checkoutUrl } = await createBookingPaymentSession(booking));
      }
    }

    const currentOffer = await prisma.bookingOffer.findFirst({
      where: { bookingId: finalBooking.id, status: OFFER_STATUS.PENDING },
      orderBy: { sequence: "desc" },
    });

    res.status(201).json({
      id: finalBooking.id,
      status: finalBooking.status,
      bookingType: finalBooking.bookingType,
      scheduledAt: finalBooking.scheduledAt,
      operatorId: finalBooking.operatorId,
      distanceKm: finalBooking.distanceKm,
      subtotal: finalBooking.subtotal,
      serviceFee: finalBooking.serviceFee,
      total: finalBooking.total,
      paymentStatus: finalBooking.paymentStatus,
      checkoutUrl,
      currentOffer: currentOffer
        ? { id: currentOffer.id, offeredAt: currentOffer.offeredAt, expiresAt: currentOffer.expiresAt }
        : null,
    });
  })
);

router.post(
  "/:id/skip",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    const booking = await skipOffer(req.params.id, req.userId);
    res.json(booking);
  })
);

router.post(
  "/:id/cancel",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    const booking = await cancelBooking(req.params.id, req.userId);
    res.json(booking);
  })
);

// Patient's own trip history, newest first. Lean select — no patient
// snapshot fields needed for a list, and never the operator relation
// without an explicit safe-field select.
router.get(
  "/",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    const bookings = await prisma.booking.findMany({
      where: { userId: req.userId },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: {
        id: true,
        status: true,
        bookingType: true,
        scheduledAt: true,
        createdAt: true,
        pickupName: true,
        destinationName: true,
        distanceKm: true,
        total: true,
        operator: { select: { id: true, name: true } },
        rating: { select: { stars: true } },
      },
    });
    res.json(bookings);
  })
);

router.get(
  "/:id",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    await requireOwnedBooking(req.params.id, req.userId);
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        // Never select passwordHash — this response goes to the patient.
        operator: { select: { id: true, name: true, phone: true, fleetSummary: true } },
        ambulance: { select: { id: true, plate: true, type: true, equipment: true } },
        crew: { select: { id: true, name: true, role: true } },
      },
    });
    res.json(booking);
  })
);

router.get(
  "/:id/tracking",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    await requireOwnedBooking(req.params.id, req.userId);
    const events = await prisma.trackingEvent.findMany({
      where: { bookingId: req.params.id },
      orderBy: { createdAt: "asc" },
    });
    res.json(events);
  })
);

router.post(
  "/:id/status",
  requireOperatorAuth,
  validate(statusSchema),
  asyncHandler(async (req, res) => {
    const booking = await advanceBookingStatus(req.params.id, req.operatorId, req.body.status);
    res.json(booking);
  })
);

router.post(
  "/:id/rating",
  requirePatientAuth,
  validate(ratingSchema),
  asyncHandler(async (req, res) => {
    const { rating, operator } = await submitRating(req.params.id, req.userId, req.body);
    res.status(201).json({
      id: rating.id,
      stars: rating.stars,
      comment: rating.comment,
      operator: { id: operator.id, ratingAvg: operator.ratingAvg, ratingCount: operator.ratingCount },
    });
  })
);

router.post(
  "/:id/assign",
  requireOperatorAuth,
  validate(assignSchema),
  asyncHandler(async (req, res) => {
    const booking = await assignBookingResources(req.params.id, req.operatorId, req.body);
    res.json({
      bookingId: booking.id,
      ambulanceId: booking.ambulanceId,
      crewIds: booking.crew.map((c) => c.id),
      ambulance: booking.ambulance,
      crew: booking.crew,
    });
  })
);

export default router;
