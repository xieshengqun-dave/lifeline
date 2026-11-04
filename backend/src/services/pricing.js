// Patients pay the operator's own price and nothing else: since the SaaS
// model (2026-11-04) Lifeline earns from operator subscriptions, not trips,
// so there is no platform/service fee. serviceFee stays in the shape (always
// 0) because bookings persist it and older bookings carry a real one.
export function computeFare({ operator, distanceKm }) {
  const subtotal = Math.round((operator.baseFare + operator.perKmRate * distanceKm) * 100) / 100;
  return { subtotal, serviceFee: 0, total: subtotal };
}

// TODO(human): straight-line distance / fixed average-speed heuristic, not
// traffic-aware. Upgrade to Google Directions/Distance Matrix API (needs a
// Maps API key) for production-accurate ETAs.
const ASSUMED_AVG_SPEED_KMH = 40;

export function computeEtaMinutes(dispatchDistanceKm) {
  return Math.max(1, Math.round((dispatchDistanceKm / ASSUMED_AVG_SPEED_KMH) * 60));
}
