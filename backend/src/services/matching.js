import { prisma } from "../lib/prisma.js";
import { haversineKm, boundingBox } from "../lib/geo.js";
import { VETTING_STATUS } from "../lib/constants.js";

// Finds operators eligible to be offered a booking from this pickup point:
// approved + online, within their own serviceRadiusKm, not already tried for
// this booking. Ranked nearest first. Bounding-box prefilter (index-assisted)
// + exact Haversine on the small candidate set — see lib/geo.js for why this
// is preferred over PostGIS at pilot scale.
export async function findEligibleOperators({ pickupLat, pickupLng, excludeOperatorIds = [] }) {
  // Widest plausible radius first (max serviceRadiusKm is 10 in v1) to keep
  // the prefilter a single indexed query rather than one per operator.
  const box = boundingBox(pickupLat, pickupLng, 10);

  const candidates = await prisma.operator.findMany({
    where: {
      vettingStatus: VETTING_STATUS.APPROVED,
      online: true,
      id: { notIn: excludeOperatorIds },
      baseLat: { gte: box.minLat, lte: box.maxLat },
      baseLng: { gte: box.minLng, lte: box.maxLng },
    },
  });

  return candidates
    .map((operator) => ({
      operator,
      dispatchDistanceKm: haversineKm(pickupLat, pickupLng, operator.baseLat, operator.baseLng),
    }))
    .filter(({ operator, dispatchDistanceKm }) => dispatchDistanceKm <= operator.serviceRadiusKm)
    .sort((a, b) => a.dispatchDistanceKm - b.dispatchDistanceKm);
}
