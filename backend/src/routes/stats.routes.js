import { Router } from "express";
import { prisma } from "../lib/prisma.js";
import { requirePatientAuth } from "../lib/auth.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { VETTING_STATUS, OFFER_STATUS } from "../lib/constants.js";

const router = Router();

// Live marketplace overview for the patient Home screen — replaces the design
// mock's hardcoded numbers. Every value is real or null; the app renders "—"
// for null rather than inventing one.
router.get(
  "/overview",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    const [activeAmbulances, acceptedAgg] = await Promise.all([
      prisma.ambulance.count({
        where: {
          active: true,
          operator: { vettingStatus: VETTING_STATUS.APPROVED, online: true },
        },
      }),
      prisma.$queryRaw`
        SELECT COUNT(*)::int AS n,
               AVG(EXTRACT(EPOCH FROM ("respondedAt" - "offeredAt"))) AS secs
        FROM "BookingOffer"
        WHERE status = ${OFFER_STATUS.ACCEPTED} AND "respondedAt" IS NOT NULL`,
    ]);

    const { n, secs } = acceptedAgg[0];
    res.json({
      activeAmbulances,
      // Time from offer sent to operator tapping Accept, averaged over every
      // accepted offer so far. Null until at least one exists.
      avgResponseSecs: n > 0 && secs != null ? Math.round(Number(secs)) : null,
      acceptedSample: n,
    });
  })
);

export default router;
