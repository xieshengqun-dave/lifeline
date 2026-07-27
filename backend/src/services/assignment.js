import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { BOOKING_STATUS } from "../lib/constants.js";
import { addTrackingEvent } from "./offerEngine.js";

// Assignment happens post-accept, as its own step distinct from advancing
// trip status — re-callable anytime pre-completion so an operator can
// change ambulance/crew mid-trip if needed.
const ASSIGNABLE_STATUSES = [
  BOOKING_STATUS.ACCEPTED,
  BOOKING_STATUS.ENROUTE,
  BOOKING_STATUS.ARRIVED,
  BOOKING_STATUS.ONBOARD,
];

export async function assignBookingResources(bookingId, operatorId, { ambulanceId, crewIds }) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.operatorId !== operatorId) throw new HttpError(403, "forbidden", "Not your booking");
  if (!ASSIGNABLE_STATUSES.includes(booking.status)) {
    throw new HttpError(409, "invalid_status", `Cannot assign resources while booking is ${booking.status}`);
  }

  const data = {};

  if (ambulanceId) {
    const ambulance = await prisma.ambulance.findUnique({ where: { id: ambulanceId } });
    if (!ambulance || ambulance.operatorId !== operatorId) {
      throw new HttpError(404, "ambulance_not_found", "Ambulance not found");
    }
    if (!ambulance.active) throw new HttpError(409, "ambulance_inactive", "Ambulance is not active");
    data.ambulanceId = ambulanceId;
  }

  if (crewIds?.length) {
    const uniqueIds = [...new Set(crewIds)];
    const crew = await prisma.crew.findMany({ where: { id: { in: uniqueIds }, operatorId } });
    if (crew.length !== uniqueIds.length) {
      throw new HttpError(404, "crew_not_found", "One or more crew members not found");
    }
    const inactive = crew.find((c) => !c.active);
    if (inactive) throw new HttpError(409, "crew_inactive", `${inactive.name} is not active`);
    // Replaces the whole assigned team — same re-callable semantics as before.
    data.crew = { set: uniqueIds.map((id) => ({ id })) };
  }

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data,
    include: {
      ambulance: { select: { id: true, plate: true, type: true, equipment: true } },
      crew: { select: { id: true, name: true, role: true, phone: true } },
    },
  });

  await addTrackingEvent(bookingId, "Crew & Ambulance Assigned");

  return updated;
}
