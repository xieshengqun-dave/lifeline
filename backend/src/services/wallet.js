import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";

// Operator merchant-ledger wallet (Grab agent model). Rules:
// - Balance NEVER changes without a WalletTransaction row, and both happen
//   inside one DB transaction (atomic, auditable, balance re-derivable).
// - Credits are positive amounts, debits negative — enforced here per type.
// - This is money OPERATORS have with the platform (prepaid fee float /
//   withdrawable earnings). Patient money never enters this ledger.

export const WALLET_TX_TYPE = Object.freeze({
  TOPUP: "topup",
  SERVICE_FEE: "service_fee",
  TRIP_EARNING: "trip_earning",
  WITHDRAWAL: "withdrawal",
  ADJUSTMENT: "adjustment",
});

const CREDIT_TYPES = new Set([WALLET_TX_TYPE.TOPUP, WALLET_TX_TYPE.TRIP_EARNING]);
const DEBIT_TYPES = new Set([WALLET_TX_TYPE.SERVICE_FEE, WALLET_TX_TYPE.WITHDRAWAL]);

export async function applyWalletTransaction({ operatorId, type, amount, bookingId, orderRef, note }) {
  if (!Number.isFinite(amount) || amount === 0) {
    throw new HttpError(400, "invalid_amount", "Amount must be a non-zero number");
  }
  if (CREDIT_TYPES.has(type) && amount < 0) {
    throw new HttpError(400, "invalid_amount", `${type} must be a credit (positive)`);
  }
  if (DEBIT_TYPES.has(type) && amount > 0) {
    throw new HttpError(400, "invalid_amount", `${type} must be a debit (negative)`);
  }

  return prisma.$transaction(async (tx) => {
    // Atomic increment — no read-modify-write, so concurrent movements can't
    // lose each other (review finding 2026-08-06). balanceAfter is read back
    // from the same atomic update inside the transaction.
    let updated;
    try {
      updated = await tx.operator.update({
        where: { id: operatorId },
        data: { walletBalance: { increment: amount } },
        select: { walletBalance: true },
      });
    } catch (err) {
      if (err.code === "P2025") throw new HttpError(404, "not_found", "Operator not found");
      throw err;
    }
    const balanceAfter = Math.round(updated.walletBalance * 100) / 100;
    const row = await tx.walletTransaction.create({
      data: { operatorId, type, amount, balanceAfter, bookingId, orderRef, note },
    });
    return row;
  });
}

// A P2002 unique violation on (bookingId, type) or orderRef means another
// concurrent request already posted this exact movement — the DB is the
// final idempotency arbiter; callers treat it as already-done.
export const isDuplicateMovement = (err) => err?.code === "P2002";

// Fee for a completed trip. Idempotent per booking: a second completion
// attempt (409-guarded upstream anyway) can't double-charge. Deducts even if
// it takes the balance negative — the fee was locked in at offer time and
// gating happens at offer time, not completion (a concurrent trip may have
// drained the float in between; the ledger records reality).
export async function chargeServiceFee(booking) {
  if (!booking.operatorId || !booking.serviceFee || booking.serviceFee <= 0) return null;
  try {
    return await applyWalletTransaction({
      operatorId: booking.operatorId,
      type: WALLET_TX_TYPE.SERVICE_FEE,
      amount: -booking.serviceFee,
      bookingId: booking.id,
      note: `Platform fee — trip ${booking.pickupName} → ${booking.destinationName}`,
    });
  } catch (err) {
    // (bookingId, type) unique: a concurrent settle already posted the fee.
    if (isDuplicateMovement(err)) return null;
    throw err;
  }
}

// Prepaid trip settled through the platform. Two-line ledger (design spec,
// user-approved 2026-08-05): the FULL fare is credited, then the platform
// fee is deducted as its own row — operators can audit the fee. Net equals
// the subtotal. Both lines are idempotent per booking. (Cash trips get only
// the fee deduction — the operator holds the fare in hand.)
export async function creditTripEarning(booking) {
  if (!booking.operatorId || !booking.total || booking.total <= 0) return null;
  try {
    return await applyWalletTransaction({
      operatorId: booking.operatorId,
      type: WALLET_TX_TYPE.TRIP_EARNING,
      amount: booking.total,
      bookingId: booking.id,
      note: `Trip fare — ${booking.pickupName} → ${booking.destinationName}`,
    });
  } catch (err) {
    if (isDuplicateMovement(err)) return null;
    throw err;
  }
}

// Offer-time gate (decided 2026-07-31): an operator only receives a job if
// their wallet covers that job's service fee — no debt by design.
export function canCoverFee(operator, serviceFee) {
  if (!serviceFee || serviceFee <= 0) return true;
  return operator.walletBalance >= serviceFee;
}
