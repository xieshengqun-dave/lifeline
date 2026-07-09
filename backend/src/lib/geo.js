// Bounding-box prefilter + exact Haversine distance — not PostGIS. At pilot
// scale (single-digit to low-hundreds of operators) a full scan of approved
// operators plus in-app Haversine is sub-millisecond, and it avoids adding
// PostGIS (not installed here, ~11 extra brew deps) and Prisma raw-SQL
// geography columns. See backend/README.md for the PostGIS upgrade path.

const EARTH_RADIUS_KM = 6371;

function toRad(deg) {
  return (deg * Math.PI) / 180;
}

export function haversineKm(lat1, lng1, lat2, lng2) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_KM * c;
}

// Cheap index-assisted prefilter — a rectangle guaranteed to contain the
// full radius circle (slightly larger at the corners, refined by the exact
// Haversine check afterward).
export function boundingBox(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111.32; // ~km per degree latitude
  const lngDelta = radiusKm / (111.32 * Math.cos(toRad(lat)) || 1);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
