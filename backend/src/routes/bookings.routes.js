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
  skipOffer,
  cancelBooking,
  advanceBookingStatus,
} from "../services/offerEngine.js";
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
  paymentMethod: z.string().min(1),
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
    });

    const currentOffer = await prisma.bookingOffer.findFirst({
      where: { bookingId: booking.id, status: OFFER_STATUS.PENDING },
      orderBy: { sequence: "desc" },
    });

    res.status(201).json({
      id: booking.id,
      status: booking.status,
      bookingType: booking.bookingType,
      scheduledAt: booking.scheduledAt,
      operatorId: booking.operatorId,
      distanceKm: booking.distanceKm,
      subtotal: booking.subtotal,
      serviceFee: booking.serviceFee,
      total: booking.total,
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
