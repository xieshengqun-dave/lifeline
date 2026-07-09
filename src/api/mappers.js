// Bridges the frontend's field names/shapes to the backend API's.

// LocationScreen produces {latitude, longitude, name}; the API wants {lat, lng, name}.
export const toApiLocation = (loc) => ({ name: loc.name, lat: loc.latitude, lng: loc.longitude });

// AssessScreen's pill-selector strings -> the API's patient{} shape.
// oxygenFlow: the API stores a real Int (L/min), but the UI only asks a
// threshold ("<5L"/">5L") — mapped to representative values rather than an
// exact count, since operators don't even see this field precisely today
// (GET /operator/requests only ever exposed oxygen as a boolean).
export const toApiPatient = (b) => ({
  age: Number(b.age) || undefined,
  gender: b.gender,
  consciousLevel: b.cond,
  oxygen: b.oxy === "Yes",
  oxygenFlow: b.oxy === "Yes" ? (b.flow === "<5L" ? 4 : 6) : undefined,
  ivTherapy: b.iv === "Yes",
  medication: b.iv === "Yes" ? (b.medication || undefined) : undefined,
  diagnosis: b.diagnosisType === "RTA" ? "RTA" : (b.diagnosisOther || undefined),
  specialRequest: b.specialRequest || undefined,
});

// Reconciles the quote response's operator shape ({operatorId, ...}) and the
// socket offer_operator event's shape ({id, ...}) into one consistent shape
// used everywhere downstream (context, Waiting, Payment). fleetSummary may be
// absent after a socket-driven handoff (the socket payload doesn't include
// it) — acceptable, it's not prominently shown post-selection anyway.
export const normalizeOperator = (op) => ({
  operatorId: op.operatorId ?? op.id,
  name: op.name,
  fleetSummary: op.fleetSummary,
  dispatchDistanceKm: op.dispatchDistanceKm,
  etaMinutes: op.etaMinutes,
  price: op.price,
});
