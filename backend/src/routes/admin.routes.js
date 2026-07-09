import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { requireAdmin } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { VETTING_STATUS, PLATFORM_FEE_TYPE } from "../lib/constants.js";
import { getPlatformFeeSetting, updatePlatformFeeSetting } from "../services/settings.js";
import { getCompletedTripCounts } from "../services/rating.js";

// Static shared-secret admin auth, no admin user table — pilot-only,
// intentionally minimal until the Phase 4 admin dashboard build.
const router = Router();

// Never select passwordHash for any admin-facing operator response.
const SAFE_OPERATOR_FIELDS = {
  id: true,
  name: true,
  email: true,
  phone: true,
  address: true,
  baseLat: true,
  baseLng: true,
  serviceRadiusKm: true,
  baseFare: true,
  perKmRate: true,
  fleetSummary: true,
  vettingStatus: true,
  online: true,
  ratingAvg: true,
  ratingCount: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { ambulances: true } },
};

const createOperatorSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
  phone: z.string().optional(),
  address: z.string().optional(),
  baseLat: z.number(),
  baseLng: z.number(),
  serviceRadiusKm: z.number().positive().optional(),
  baseFare: z.number().nonnegative(),
  perKmRate: z.number().nonnegative(),
});

const editOperatorSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
  address: z.string().optional(),
  baseLat: z.number().optional(),
  baseLng: z.number().optional(),
  serviceRadiusKm: z.number().positive().optional(),
  baseFare: z.number().nonnegative().optional(),
  perKmRate: z.number().nonnegative().optional(),
});

const platformFeeSchema = z
  .object({
    feeType: z.enum([PLATFORM_FEE_TYPE.FLAT, PLATFORM_FEE_TYPE.PERCENT]),
    feeValue: z.number().nonnegative(),
  })
  .refine((b) => b.feeType !== PLATFORM_FEE_TYPE.PERCENT || b.feeValue <= 100, {
    message: "feeValue must be <= 100 when feeType is percent",
    path: ["feeValue"],
  });

function withAmbulanceCount({ _count, ...operator }) {
  return { ...operator, ambulanceCount: _count.ambulances };
}

router.get(
  "/operators",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const operators = await prisma.operator.findMany({
      select: SAFE_OPERATOR_FIELDS,
      orderBy: { createdAt: "asc" },
    });
    const tripCounts = await getCompletedTripCounts(operators.map((o) => o.id));
    res.json(operators.map((o) => ({ ...withAmbulanceCount(o), tripCount: tripCounts[o.id] || 0 })));
  })
);

router.post(
  "/operators",
  requireAdmin,
  validate(createOperatorSchema),
  asyncHandler(async (req, res) => {
    const { password, ...rest } = req.body;
    const passwordHash = await bcrypt.hash(password, 10);
    let operator;
    try {
      operator = await prisma.operator.create({
        data: { ...rest, passwordHash, vettingStatus: VETTING_STATUS.PENDING },
        select: SAFE_OPERATOR_FIELDS,
      });
    } catch (err) {
      if (err.code === "P2002") throw new HttpError(409, "email_taken", "An operator with this email already exists");
      throw err;
    }
    res.status(201).json({ ...withAmbulanceCount(operator), tripCount: 0 });
  })
);

router.put(
  "/operators/:id",
  requireAdmin,
  validate(editOperatorSchema),
  asyncHandler(async (req, res) => {
    const operator = await prisma.operator.update({
      where: { id: req.params.id },
      data: req.body,
      select: SAFE_OPERATOR_FIELDS,
    });
    const tripCounts = await getCompletedTripCounts([operator.id]);
    res.json({ ...withAmbulanceCount(operator), tripCount: tripCounts[operator.id] || 0 });
  })
);

router.get(
  "/settings/platform-fee",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    res.json(await getPlatformFeeSetting());
  })
);

router.put(
  "/settings/platform-fee",
  requireAdmin,
  validate(platformFeeSchema),
  asyncHandler(async (req, res) => {
    res.json(await updatePlatformFeeSetting(req.body));
  })
);

router.post(
  "/operators/:id/approve",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const operator = await prisma.operator.update({
      where: { id: req.params.id },
      data: { vettingStatus: VETTING_STATUS.APPROVED },
      select: SAFE_OPERATOR_FIELDS,
    });
    res.json(withAmbulanceCount(operator));
  })
);

router.post(
  "/operators/:id/suspend",
  requireAdmin,
  asyncHandler(async (req, res) => {
    const operator = await prisma.operator.update({
      where: { id: req.params.id },
      data: { vettingStatus: VETTING_STATUS.SUSPENDED },
      select: SAFE_OPERATOR_FIELDS,
    });
    res.json(withAmbulanceCount(operator));
  })
);

router.get(
  "/bookings",
  requireAdmin,
  asyncHandler(async (_req, res) => {
    const bookings = await prisma.booking.findMany({
      include: {
        operator: { select: SAFE_OPERATOR_FIELDS },
        offers: { select: { offeredAt: true, respondedAt: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(bookings.map((b) => ({ ...b, operator: b.operator ? withAmbulanceCount(b.operator) : null })));
  })
);

export default router;
