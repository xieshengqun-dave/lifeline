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

export async function assignBookingResources(bookingId, operatorId, { ambulanceId, crewId }) {
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

  if (crewId) {
    const crew = await prisma.crew.findUnique({ where: { id: crewId } });
    if (!crew || crew.operatorId !== operatorId) {
      throw new HttpError(404, "crew_not_found", "Crew member not found");
    }
    if (!crew.active) throw new HttpError(409, "crew_inactive", "Crew member is not active");
    data.crewId = crewId;
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
