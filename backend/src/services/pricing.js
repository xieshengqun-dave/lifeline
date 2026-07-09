import { resolveFeeAmount } from "./settings.js";

// Fee model is additive (total = subtotal + fee) and the fee amount/type is
// admin-configurable via PlatformSettings (see services/settings.js) — the
// caller resolves the current setting once and passes it in, so this stays a
// synchronous pure function.
export function computeFare({ operator, distanceKm, feeSetting }) {
  const subtotal = Math.round((operator.baseFare + operator.perKmRate * distanceKm) * 100) / 100;
  const serviceFee = resolveFeeAmount(feeSetting, subtotal);
  const total = Math.round((subtotal + serviceFee) * 100) / 100;
  return { subtotal, serviceFee, total };
}

// TODO(human): straight-line distance / fixed average-speed heuristic, not
// traffic-aware. Upgrade to Google Directions/Distance Matrix API (needs a
// Maps API key) for production-accurate ETAs.
const ASSUMED_AVG_SPEED_KMH = 40;

export function computeEtaMinutes(dispatchDistanceKm) {
  return Math.max(1, Math.round((dispatchDistanceKm / ASSUMED_AVG_SPEED_KMH) * 60));
}
