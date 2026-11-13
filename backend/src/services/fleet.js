import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { AMBULANCE_TYPE, BOOKING_STATUS } from "../lib/constants.js";

// Fleet & crew management (2026-11-13). Before this, ambulances and crew
// could only be created by the seed script, so a real operator had no way to
// run a trip. Used by both the operator app (their own fleet) and the admin
// dashboard (any operator's) — every function is scoped to an operatorId and
// refuses rows that belong to someone else.
//
// Nothing is ever deleted: past bookings reference these rows. "Removing" a
// unit or crew member = active: false, which hides it from assignment.

const IN_PROGRESS = [
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.ENROUTE,
  BOOKING_STATUS.ARRIVED,
  BOOKING_STATUS.ONBOARD,
];

const AMBULANCE_SELECT = { id: true, plate: true, type: true, equipment: true, active: true };
const CREW_SELECT = { id: true, name: true, role: true, phone: true, active: true };

// Malaysian plates vary (WXY 1234, KV 88 A, military/diplomatic…), so only
// the shape is normalised: upper-case, single spaces.
export const normalisePlate = (plate) => plate.trim().toUpperCase().replace(/\s+/g, " ");

export async function listFleet(operatorId, { includeInactive = false } = {}) {
  const where = { operatorId, ...(includeInactive ? {} : { active: true }) };
  const [ambulances, crew] = await Promise.all([
    prisma.ambulance.findMany({ where, select: AMBULANCE_SELECT, orderBy: [{ active: "desc" }, { createdAt: "asc" }] }),
    prisma.crew.findMany({ where, select: CREW_SELECT, orderBy: [{ active: "desc" }, { name: "asc" }] }),
  ]);
  return { ambulances, crew };
}

// "2 ALS, 1 BLS" — the rollup patients see next to the operator's name.
// Recomputed from the active units whenever the fleet changes.
async function refreshFleetSummary(operatorId) {
  const active = await prisma.ambulance.findMany({ where: { operatorId, active: true }, select: { type: true } });
  const counts = {};
  for (const a of active) counts[a.type] = (counts[a.type] || 0) + 1;
  const order = Object.values(AMBULANCE_TYPE);
  const summary = Object.keys(counts)
    .sort((a, b) => order.indexOf(a) - order.indexOf(b))
    .map((type) => `${counts[type]} ${type}`)
    .join(", ");
  await prisma.operator.update({ where: { id: operatorId }, data: { fleetSummary: summary || null } });
}

async function requireOperator(operatorId) {
  const operator = await prisma.operator.findUnique({ where: { id: operatorId }, select: { id: true } });
  if (!operator) throw new HttpError(404, "not_found", "Operator not found");
}

function plateTaken(err) {
  return err.code === "P2002"
    ? new HttpError(409, "plate_taken", "An ambulance with this plate number is already registered")
    : err;
}

export async function createAmbulance(operatorId, { plate, type, equipment = [] }) {
  await requireOperator(operatorId);
  let ambulance;
  try {
    ambulance = await prisma.ambulance.create({
      data: { operatorId, plate: normalisePlate(plate), type, equipment },
      select: AMBULANCE_SELECT,
    });
  } catch (err) {
    throw plateTaken(err);
  }
  await refreshFleetSummary(operatorId);
  return ambulance;
}

export async function updateAmbulance(operatorId, ambulanceId, { plate, type, equipment, active }) {
  const existing = await prisma.ambulance.findUnique({ where: { id: ambulanceId } });
  if (!existing || existing.operatorId !== operatorId) {
    throw new HttpError(404, "ambulance_not_found", "Ambulance not found");
  }
  if (active === false && existing.active) {
    const busy = await prisma.booking.count({ where: { ambulanceId, status: { in: IN_PROGRESS } } });
    if (busy) {
      throw new HttpError(409, "ambulance_in_use", "This ambulance is assigned to a trip in progress — finish or reassign the trip first");
    }
  }
  let ambulance;
  try {
    ambulance = await prisma.ambulance.update({
      where: { id: ambulanceId },
      data: {
        ...(plate !== undefined ? { plate: normalisePlate(plate) } : {}),
        ...(type !== undefined ? { type } : {}),
        ...(equipment !== undefined ? { equipment } : {}),
        ...(active !== undefined ? { active } : {}),
      },
      select: AMBULANCE_SELECT,
    });
  } catch (err) {
    throw plateTaken(err);
  }
  await refreshFleetSummary(operatorId);
  return ambulance;
}

export async function createCrew(operatorId, { name, role, phone }) {
  await requireOperator(operatorId);
  return prisma.crew.create({
    data: { operatorId, name: name.trim(), role, phone: phone || null },
    select: CREW_SELECT,
  });
}

export async function updateCrew(operatorId, crewId, { name, role, phone, active }) {
  const existing = await prisma.crew.findUnique({ where: { id: crewId } });
  if (!existing || existing.operatorId !== operatorId) {
    throw new HttpError(404, "crew_not_found", "Crew member not found");
  }
  if (active === false && existing.active) {
    const busy = await prisma.booking.count({ where: { crew: { some: { id: crewId } }, status: { in: IN_PROGRESS } } });
    if (busy) {
      throw new HttpError(409, "crew_in_use", `${existing.name} is assigned to a trip in progress — finish or reassign the trip first`);
    }
  }
  return prisma.crew.update({
    where: { id: crewId },
    data: {
      ...(name !== undefined ? { name: name.trim() } : {}),
      ...(role !== undefined ? { role } : {}),
      ...(phone !== undefined ? { phone: phone || null } : {}),
      ...(active !== undefined ? { active } : {}),
    },
    select: CREW_SELECT,
  });
}

// True when the operator could actually run a trip: at least one active
// ambulance and one active crew member. Checked before going online.
export async function hasUsableFleet(operatorId) {
  const [ambulances, crew] = await Promise.all([
    prisma.ambulance.count({ where: { operatorId, active: true } }),
    prisma.crew.count({ where: { operatorId, active: true } }),
  ]);
  return ambulances > 0 && crew > 0;
}
