import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma.js";
import { requireOperatorAuth } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { acceptOffer, declineOffer } from "../services/offerEngine.js";
import { OFFER_STATUS, BOOKING_STATUS } from "../lib/constants.js";

const router = Router();

const availabilitySchema = z.object({ online: z.boolean() });

const OPERATOR_BOOKING_STATUSES = [
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.ENROUTE,
  BOOKING_STATUS.ARRIVED,
  BOOKING_STATUS.ONBOARD,
  BOOKING_STATUS.COMPLETED,
  BOOKING_STATUS.CANCELLED,
];

router.get(
  "/me",
  requireOperatorAuth,
  asyncHandler(async (req, res) => {
    const operator = await prisma.operator.findUnique({
      where: { id: req.operatorId },
      select: { id: true, name: true, online: true, vettingStatus: true },
    });
    res.json(operator);
  })
);

router.get(
  "/fleet",
  requireOperatorAuth,
  asyncHandler(async (req, res) => {
    const [ambulances, crew] = await Promise.all([
      prisma.ambulance.findMany({
        where: { operatorId: req.operatorId, active: true },
        select: { id: true, plate: true, type: true, equipment: true },
      }),
      prisma.crew.findMany({
        where: { operatorId: req.operatorId, active: true },
        select: { id: true, name: true, role: true, phone: true },
      }),
    ]);
    res.json({ ambulances, crew });
  })
);

router.get(
  "/bookings",
  requireOperatorAuth,
  asyncHandler(async (req, res) => {
    const bookings = await prisma.booking.findMany({
      where: { operatorId: req.operatorId, status: { in: OPERATOR_BOOKING_STATUSES } },
      select: {
        id: true, status: true, pickupName: true, destinationName: true, distanceKm: true,
        subtotal: true, serviceFee: true, total: true, paymentStatus: true,
        createdAt: true, updatedAt: true,
        ambulance: { select: { id: true, plate: true, type: true } },
        crew: { select: { id: true, name: true, role: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    res.json(bookings);
  })
);

router.get(
  "/bookings/:id",
  requireOperatorAuth,
  asyncHandler(async (req, res) => {
    const booking = await prisma.booking.findUnique({
      where: { id: req.params.id },
      include: {
        ambulance: { select: { id: true, plate: true, type: true, equipment: true } },
        crew: { select: { id: true, name: true, role: true, phone: true } },
      },
    });
    if (!booking) throw new HttpError(404, "not_found", "Booking not found");
    if (booking.operatorId !== req.operatorId) throw new HttpError(403, "forbidden", "Not your booking");
    res.json(booking);
  })
);

router.get(
  "/requests",
  requireOperatorAuth,
  asyncHandler(async (req, res) => {
    const offers = await prisma.bookingOffer.findMany({
      where: { operatorId: req.operatorId, status: OFFER_STATUS.PENDING },
      include: { booking: true },
      orderBy: { offeredAt: "asc" },
    });

    res.json(
      offers.map(({ booking, ...offer }) => ({
        offerId: offer.id,
        bookingId: booking.id,
        dispatchDistanceKm: offer.dispatchDistanceKm,
        // Read straight off the booking, not re-derived from a possibly-since
        // -changed platform fee setting — booking.serviceFee/total were
        // locked in at offer time (see offerEngine.js's offerToOperator).
        price: {
          subtotal: offer.computedPrice,
          serviceFee: booking.serviceFee,
          total: booking.total,
        },
        pickup: { name: booking.pickupName, lat: booking.pickupLat, lng: booking.pickupLng },
        destination: { name: booking.destinationName, lat: booking.destinationLat, lng: booking.destinationLng },
        patientSummary: {
          age: booking.patientAge,
          consciousLevel: booking.consciousLevel,
          oxygen: booking.oxygen,
          oxygenFlow: booking.oxygenFlow,
          ivTherapy: booking.ivTherapy,
          medication: booking.medication,
          diagnosis: booking.diagnosis,
          specialRequest: booking.specialRequest,
        },
        offeredAt: offer.offeredAt,
        expiresAt: offer.expiresAt,
        status: offer.status,
      }))
    );
  })
);

router.post(
  "/offers/:id/accept",
  requireOperatorAuth,
  asyncHandler(async (req, res) => {
    const booking = await acceptOffer(req.params.id, req.operatorId);
    res.json({ bookingId: booking.id, status: booking.status });
  })
);

router.post(
  "/offers/:id/decline",
  requireOperatorAuth,
  asyncHandler(async (req, res) => {
    const booking = await declineOffer(req.params.id, req.operatorId);
    res.json({
      bookingId: booking.id,
      status: booking.status,
      ...(booking.status === BOOKING_STATUS.OFFERED ? { nextOperatorId: booking.operatorId } : {}),
    });
  })
);

router.post(
  "/availability",
  requireOperatorAuth,
  validate(availabilitySchema),
  asyncHandler(async (req, res) => {
    await prisma.operator.update({ where: { id: req.operatorId }, data: { online: req.body.online } });
    res.json({ online: req.body.online });
  })
);

export default router;
