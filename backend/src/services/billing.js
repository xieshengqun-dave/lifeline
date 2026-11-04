import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { VETTING_STATUS } from "../lib/constants.js";
import { WALLET_TX_TYPE, amountOwed, applyWalletTransaction, isDuplicateMovement } from "./wallet.js";
import { getSubscriptionSettings } from "./settings.js";
import { pushToOperator } from "./push.js";

// Operator billing — SaaS model (decided 2026-11-04). Patients pay operators
// directly; Lifeline charges each approved operator a monthly subscription.
// On the 1st (MYT) the month's subscription is posted to the operator's
// wallet ledger as a "subscription" debit, so a negative balance is what they
// owe. It is due on the BO-set due day; still unpaid graceDays after that and
// the operator is paused (billingHold, reason "overdue") — hidden from
// patients until the admin records their payment, which releases the hold.
// Admins can also pause/resume anyone by hand (reason "manual").
//
// Statements are derived purely from the ledger. The opening balance is
// worked BACKWARDS from today's balance (current balance minus every movement
// since the month started), so it is right even for operators whose starting
// float predates the ledger (seeded balances have no row).

const MYT_OFFSET_MS = 8 * 60 * 60 * 1000; // Malaysia is UTC+8, no DST
const DAY_MS = 24 * 60 * 60 * 1000;
const round2 = (n) => Math.round(n * 100) / 100;

export const HOLD_REASON = Object.freeze({ MANUAL: "manual", OVERDUE: "overdue" });

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

export function monthLabel(month) {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-MY", { month: "long", year: "numeric", timeZone: "UTC" });
}

// "Due by the 7th" = overdue from the start of the 8th (MYT). The pause
// lands graceDays after that.
export function billingDates(month, { dueDay, graceDays }) {
  const { start } = monthRange(month);
  const dueAt = new Date(start.getTime() + dueDay * DAY_MS);
  const pauseAt = new Date(dueAt.getTime() + graceDays * DAY_MS);
  return { dueAt, pauseAt };
}

export const effectivePrice = (operator, settings) => operator.subscriptionPrice ?? settings.price;

// paused | paid | due | overdue — for the Billing page and the operator app.
export function billingStatus(operator, settings, now = new Date()) {
  if (operator.billingHold) return "paused";
  if (amountOwed(operator.walletBalance) <= 0) return "paid";
  const { dueAt } = billingDates(currentMonth(now), settings);
  return now >= dueAt ? "overdue" : "due";
}

function summarise(transactions) {
  let subscription = 0;
  let tripFees = 0;
  let payments = 0;
  let other = 0;
  for (const tx of transactions) {
    if (tx.type === WALLET_TX_TYPE.SUBSCRIPTION) subscription += -tx.amount;
    else if (tx.type === WALLET_TX_TYPE.SERVICE_FEE) tripFees += -tx.amount; // legacy per-trip fees
    else if (tx.type === WALLET_TX_TYPE.TOPUP) payments += tx.amount;
    else other += tx.amount;
  }
  return {
    subscription: round2(subscription),
    tripFees: round2(tripFees),
    charges: round2(subscription + tripFees),
    payments: round2(payments),
    other: round2(other),
  };
}

// ── Monthly cycle: charge, then pause/release ──

async function setHold(operatorId, hold, reason) {
  return prisma.operator.update({
    where: { id: operatorId },
    data: hold
      ? { billingHold: true, billingHoldReason: reason, billingHoldAt: new Date(), online: false }
      : { billingHold: false, billingHoldReason: null, billingHoldAt: null },
  });
}

// Admin pause/resume. Pausing also takes the operator offline; resuming
// leaves them offline until they switch themselves back on.
export async function setManualHold(operatorId, hold) {
  const op = await prisma.operator.findUnique({ where: { id: operatorId }, select: { id: true } });
  if (!op) throw new HttpError(404, "not_found", "Operator not found");
  const updated = await setHold(operatorId, hold, HOLD_REASON.MANUAL);
  if (hold) {
    pushToOperator(operatorId, {
      title: "Account paused",
      body: "Your Lifeline account is paused and hidden from patients. Contact Lifeline for details.",
    });
  }
  return updated;
}

// After a payment is recorded: an automatic (overdue) hold lifts once the
// operator owes nothing. Manual holds stay until an admin resumes them.
export async function releaseOverdueHoldIfPaid(operatorId) {
  const op = await prisma.operator.findUnique({
    where: { id: operatorId },
    select: { billingHold: true, billingHoldReason: true, walletBalance: true },
  });
  if (!op?.billingHold || op.billingHoldReason !== HOLD_REASON.OVERDUE || op.walletBalance < 0) return false;
  await setHold(operatorId, false);
  pushToOperator(operatorId, {
    title: "Account active again",
    body: "Thanks — your payment is recorded. Switch online to receive requests.",
  });
  return true;
}

// Idempotent: safe to run as often as we like (hourly sweep + boot). The
// subscription row's orderRef is unique per operator per month, so a month
// is never charged twice even across concurrent runs.
export async function runSubscriptionCycle(now = new Date()) {
  const month = currentMonth(now);
  const { start } = monthRange(month);
  const settings = await getSubscriptionSettings();
  const operators = await prisma.operator.findMany({
    where: { vettingStatus: VETTING_STATUS.APPROVED },
    select: { id: true, subscriptionPrice: true, approvedAt: true },
  });

  let charged = 0;
  for (const op of operators) {
    const price = effectivePrice(op, settings);
    if (!(price > 0)) continue;
    // First charge is the month after approval.
    if (op.approvedAt && op.approvedAt >= start) continue;
    try {
      await applyWalletTransaction({
        operatorId: op.id,
        type: WALLET_TX_TYPE.SUBSCRIPTION,
        amount: -price,
        orderRef: `subscription:${op.id}:${month}`,
        note: `Lifeline subscription — ${monthLabel(month)}`,
      });
      charged += 1;
    } catch (err) {
      if (!isDuplicateMovement(err)) throw err; // already charged this month
    }
  }

  let paused = 0;
  const { pauseAt } = billingDates(month, settings);
  if (now >= pauseAt) {
    const overdue = await prisma.operator.findMany({
      where: { vettingStatus: VETTING_STATUS.APPROVED, billingHold: false, walletBalance: { lt: 0 } },
      select: { id: true, walletBalance: true },
    });
    for (const op of overdue) {
      await setHold(op.id, true, HOLD_REASON.OVERDUE);
      paused += 1;
      pushToOperator(op.id, {
        title: "Account paused — payment overdue",
        body: `You owe RM ${amountOwed(op.walletBalance).toFixed(2)}. Patients can't see you until it's paid. Open Wallet → How to pay.`,
      });
    }
  }

  // Overdue holds whose balance has since been settled (e.g. adjusted by an
  // admin outside the payment route) are released too.
  const settled = await prisma.operator.findMany({
    where: { billingHold: true, billingHoldReason: HOLD_REASON.OVERDUE, walletBalance: { gte: 0 } },
    select: { id: true },
  });
  for (const op of settled) await releaseOverdueHoldIfPaid(op.id);

  return { month, charged, paused, released: settled.length };
}

const SWEEP_INTERVAL_MS = 60 * 60 * 1000;

export function startSubscriptionSweep() {
  const run = () =>
    runSubscriptionCycle().catch((err) => {
      // Loud, never fatal: billing must not take the booking API down.
      console.error("SUBSCRIPTION CYCLE FAILED — billing not applied this run", err);
    });
  setTimeout(run, 15_000);
  setInterval(run, SWEEP_INTERVAL_MS);
}

// ── Statements ──

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
  // legacy per-trip fee lines come from one extra lookup.
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

// What the operator app shows: this month's plan, dates and standing.
export async function getOperatorBillingInfo(operatorId, now = new Date()) {
  const [operator, settings] = await Promise.all([
    prisma.operator.findUnique({
      where: { id: operatorId },
      select: { walletBalance: true, subscriptionPrice: true, billingHold: true, billingHoldReason: true },
    }),
    getSubscriptionSettings(),
  ]);
  if (!operator) throw new HttpError(404, "not_found", "Operator not found");
  const month = currentMonth(now);
  const { dueAt, pauseAt } = billingDates(month, settings);
  return {
    month,
    price: effectivePrice(operator, settings),
    dueDay: settings.dueDay,
    graceDays: settings.graceDays,
    dueAt,
    pauseAt,
    amountOwed: amountOwed(operator.walletBalance),
    status: billingStatus(operator, settings, now),
    billingHold: operator.billingHold,
    billingHoldReason: operator.billingHoldReason,
  };
}

// One row per operator for the admin Billing page.
export async function getBillingSummary(month, now = new Date()) {
  const { start, end } = monthRange(month);
  const [operators, inMonth, sinceStart, settings] = await Promise.all([
    prisma.operator.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        vettingStatus: true,
        walletBalance: true,
        subscriptionPrice: true,
        billingHold: true,
        billingHoldReason: true,
      },
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
    getSubscriptionSettings(),
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
      price: effectivePrice(op, settings),
      customPrice: op.subscriptionPrice,
      billingHold: op.billingHold,
      billingHoldReason: op.billingHoldReason,
      status: billingStatus(op, settings, now),
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
    settings,
    ...billingDates(month, settings),
    totals: {
      charges: round2(rows.reduce((s, r) => s + r.charges, 0)),
      payments: round2(rows.reduce((s, r) => s + r.payments, 0)),
      amountDue: round2(rows.reduce((s, r) => s + r.amountDue, 0)),
      currentAmountOwed: round2(rows.reduce((s, r) => s + r.currentAmountOwed, 0)),
      paused: rows.filter((r) => r.billingHold).length,
    },
    operators: rows,
  };
}
