import { prisma } from "../lib/prisma.js";

// Marks a PaymentOrder paid exactly once (CAS pending→paid) — the atomic
// settlement gate every gateway webhook goes through. Returns the fresh row,
// or null if it was already settled (callers treat that as a no-op success).
export async function settlePaymentOrder(order, gatewayRef) {
  const { count } = await prisma.paymentOrder.updateMany({
    where: { id: order.id, status: "pending" },
    data: { status: "paid", gatewayRef, paidAt: new Date() },
  });
  return count === 1 ? prisma.paymentOrder.findUnique({ where: { id: order.id } }) : null;
}
