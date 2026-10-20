import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { WALLET_TX_TYPE, amountOwed } from "./wallet.js";

// Monthly operator billing (decided 2026-10-20). Patients pay operators
// directly; each completed trip's platform fee is a service_fee row in the
// wallet ledger, so a negative balance is what the operator owes. At month
// end the admin sends each operator their statement; the operator pays by
// bank transfer / DuitNow and the admin records it as a top-up.
//
// Statements are derived purely from the ledger. The opening balance is
// worked BACKWARDS from today's balance (current balance minus every movement
// since the month started), so it is right even for operators whose starting
// float predates the ledger (seeded balances have no row).

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8, no DST
const round2 = (n) => Math.round(n * 100) / 100;

// "2026-10" → [start, end) as UTC instants for that calendar month in MYT.
export function monthRange(month) {
  const m = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(month || "");
  if (!m) throw new HttpError(400, "invalid_month", "month must look like YYYY-MM");
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const start = new Date(Date.UTC(y, mo, 1) - MYT_OFFSET_MS);
  const end = new Date(Date.UTC(y, mo + 1, 1) - MYT_OFFSET_MS);
  return { start, end };
}

// The current month in MYT, as "YYYY-MM".
export function currentMonth(now = new Date()) {
  return new Date(now.getTime() + MYT_OFFSET_MS).toISOString().slice(0, 7);
}

function summarise(transactions) {
  let fees = 0;
  let payments = 0;
  let other = 0;
  let trips = 0;
  for (const tx of transactions) {
    if (tx.type === WALLET_TX_TYPE.SERVICE_FEE) {
      fees += -tx.amount;
      trips += 1;
    } else if (tx.type === WALLET_TX_TYPE.TOPUP) {
      payments += tx.amount;
    } else {
      other += tx.amount;
    }
  }
  return { trips, fees: round2(fees), payments: round2(payments), other: round2(other) };
}

export async function getOperatorStatement(operatorId, month) {
  const { start, end } = monthRange(month);
  const operator = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { id: true, name: true, email: true, phone: true, walletBalance: true },
  });
  if (!operator) throw new HttpError(404, "not_found", "Operator not found");

  const [sinceStart, transactions] = await Promise.all([
    prisma.walletTransaction.aggregate({
      where: { operatorId, createdAt: { gte: start } },
      _sum: { amount: true },
    }),
    prisma.walletTransaction.findMany({
      where: { operatorId, createdAt: { gte: start, lt: end } },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  // Ledger rows carry a plain bookingId (no relation), so trip details for
  // the statement lines come from one extra lookup.
  const bookingIds = [...new Set(transactions.map((tx) => tx.bookingId).filter(Boolean))];
  const bookings = bookingIds.length
    ? await prisma.booking.findMany({
        where: { id: { in: bookingIds } },
        select: { id: true, pickupName: true, destinationName: true, total: true, createdAt: true },
      })
    : [];
  const bookingById = Object.fromEntries(bookings.map((b) => [b.id, b]));

  const openingBalance = round2(operator.walletBalance - (sinceStart._sum.amount ?? 0));
  const movement = transactions.reduce((s, tx) => s + tx.amount, 0);
  const closingBalance = round2(openingBalance + movement);

  return {
    month,
    periodStart: start,
    periodEnd: end,
    operator: { id: operator.id, name: operator.name, email: operator.email, phone: operator.phone },
    openingBalance,
    closingBalance,
    amountDue: amountOwed(closingBalance),
    currentBalance: operator.walletBalance,
    currentAmountOwed: amountOwed(operator.walletBalance),
    ...summarise(transactions),
    transactions: transactions.map((tx) => ({ ...tx, booking: tx.bookingId ? bookingById[tx.bookingId] ?? null : null })),
  };
}

// One row per operator for the admin Billing page.
export async function getBillingSummary(month) {
  const { start, end } = monthRange(month);
  const [operators, inMonth, sinceStart] = await Promise.all([
    prisma.operator.findMany({
      select: { id: true, name: true, email: true, vettingStatus: true, walletBalance: true },
      orderBy: { name: "asc" },
    }),
    prisma.walletTransaction.findMany({
      where: { createdAt: { gte: start, lt: end } },
      select: { operatorId: true, type: true, amount: true },
    }),
    prisma.walletTransaction.groupBy({
      by: ["operatorId"],
      where: { createdAt: { gte: start } },
      _sum: { amount: true },
    }),
  ]);

  const sinceByOp = Object.fromEntries(sinceStart.map((g) => [g.operatorId, g._sum.amount ?? 0]));
  const txByOp = {};
  for (const tx of inMonth) (txByOp[tx.operatorId] ||= []).push(tx);

  const rows = operators.map((op) => {
    const txs = txByOp[op.id] || [];
    const openingBalance = round2(op.walletBalance - (sinceByOp[op.id] ?? 0));
    const closingBalance = round2(openingBalance + txs.reduce((s, tx) => s + tx.amount, 0));
    return {
      operatorId: op.id,
      name: op.name,
      email: op.email,
      vettingStatus: op.vettingStatus,
      openingBalance,
      closingBalance,
      amountDue: amountOwed(closingBalance),
      currentBalance: op.walletBalance,
      currentAmountOwed: amountOwed(op.walletBalance),
      ...summarise(txs),
    };
  });

  return {
    month,
    totals: {
      fees: round2(rows.reduce((s, r) => s + r.fees, 0)),
      payments: round2(rows.reduce((s, r) => s + r.payments, 0)),
      amountDue: round2(rows.reduce((s, r) => s + r.amountDue, 0)),
      currentAmountOwed: round2(rows.reduce((s, r) => s + r.currentAmountOwed, 0)),
    },
    operators: rows,
  };
}
