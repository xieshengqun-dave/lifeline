import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { BOOKING_STATUS_PROGRESSION, COLLECTED_VIA } from "../lib/constants.js";
import { addTrackingEvent } from "./offerEngine.js";

// Direct payment (2026-11-13). Patients pay the OPERATOR — cash, or a
// transfer / DuitNow scan to the operator's own account. Lifeline never
// touches that money, so two things live here:
//   1. the operator's pay-to details (bank + DuitNow QR), set by the back
//      office and shown to the patient once an operator has accepted;
//   2. the crew's record of whether the patient paid (Booking.collectedVia).
// None of this moves money or gates anything: an unpaid trip is only flagged.

const PAY_TO_SELECT = { accountName: true, bankName: true, accountNumber: true, instructions: true, qrImage: true, updatedAt: true };

const emptyPayTo = () => ({ accountName: null, bankName: null, accountNumber: null, instructions: null, qrImage: null, updatedAt: null });

const hasDetails = (p) => !!(p && (p.accountName || p.bankName || p.accountNumber || p.instructions || p.qrImage));

export async function getOperatorPayTo(operatorId) {
  const row = await prisma.operatorPayTo.findUnique({ where: { operatorId }, select: PAY_TO_SELECT });
  return row || emptyPayTo();
}

// Replaces the whole set — blank or omitted fields are cleared (same rule as
// the company pay-to details in settings.js).
export async function setOperatorPayTo(operatorId, { accountName, bankName, accountNumber, instructions, qrImage }) {
  const operator = await prisma.operator.findUnique({ where: { id: operatorId }, select: { id: true } });
  if (!operator) throw new HttpError(404, "not_found", "Operator not found");
  const data = { accountName, bankName, accountNumber, instructions, qrImage };
  return prisma.operatorPayTo.upsert({
    where: { operatorId },
    update: data,
    create: { operatorId, ...data },
    select: PAY_TO_SELECT,
  });
}

// What the patient sees: who to pay, how much, and how — only for their own
// booking, and only once an operator has actually accepted it.
export async function getBookingPayTo(bookingId, userId) {
  const booking = await prisma.booking.findUnique({
    where: { id: bookingId },
    select: {
      userId: true, status: true, total: true, paidAt: true, collectedVia: true, collectedAt: true,
      operator: { select: { id: true, name: true, phone: true } },
    },
  });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.userId !== userId) throw new HttpError(403, "forbidden", "Not your booking");

  const accepted = BOOKING_STATUS_PROGRESSION.includes(booking.status);
  const prepaid = !!booking.paidAt;
  const payTo = accepted && !prepaid && booking.operator ? await getOperatorPayTo(booking.operator.id) : null;
  return {
    amount: booking.total,
    prepaid,
    operator: accepted && booking.operator ? { name: booking.operator.name, phone: booking.operator.phone } : null,
    payTo: hasDetails(payTo) ? payTo : null,
    collectedVia: booking.collectedVia,
    collectedAt: booking.collectedAt,
  };
}

const RECEIVED_PREFIX = "Payment received by the operator";
const RECEIVED_LABEL = {
  [COLLECTED_VIA.CASH]: `${RECEIVED_PREFIX} (cash)`,
  [COLLECTED_VIA.DUITNOW]: `${RECEIVED_PREFIX} (DuitNow / transfer)`,
};

// The crew records how the patient paid. Re-callable, so a mis-tap can be
// corrected and an "unpaid" trip can be settled later. Bookings paid through
// an online gateway have nothing to collect.
export async function recordCollection(bookingId, operatorId, via) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.operatorId !== operatorId) throw new HttpError(403, "forbidden", "Not your booking");
  if (!BOOKING_STATUS_PROGRESSION.includes(booking.status)) {
    throw new HttpError(409, "invalid_status", `Cannot record a payment while the booking is ${booking.status}`);
  }
  if (booking.paidAt) {
    throw new HttpError(409, "already_paid_online", "This trip was already paid in the app — there is nothing to collect");
  }
  if (booking.collectedVia === via) return booking;

  const updated = await prisma.booking.update({
    where: { id: bookingId },
    data: { collectedVia: via, collectedAt: new Date() },
  });
  // Patient-facing timeline: only a real receipt is announced, and at most
  // once — a correction (cash → DuitNow) rewrites the line, and taking a
  // receipt back removes it. "Unpaid" itself is an internal follow-up flag,
  // never shown to the patient as an event.
  const announced = { bookingId, label: { startsWith: RECEIVED_PREFIX } };
  if (!RECEIVED_LABEL[via]) {
    await prisma.trackingEvent.deleteMany({ where: announced });
  } else if (await prisma.trackingEvent.count({ where: announced })) {
    await prisma.trackingEvent.updateMany({ where: announced, data: { label: RECEIVED_LABEL[via] } });
  } else {
    await addTrackingEvent(bookingId, RECEIVED_LABEL[via]);
  }
  return updated;
}
