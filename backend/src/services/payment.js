import Stripe from "stripe";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/env.js";
import { HttpError } from "../middleware/errorHandler.js";
import { applyWalletTransaction, WALLET_TX_TYPE } from "./wallet.js";

// THE provider boundary: every Stripe call in the codebase lives in this
// file, so a future provider switch (iPay88/Razer/…) rewrites one module.
// Saved cards live in the provider's vault — this DB only ever holds
// provider reference IDs, never card data.
//
// Test keys now; going live = swapping STRIPE_SECRET_KEY for a live key,
// which is an explicit human decision (see CLAUDE.md payments boundary).

import { fiuuEnabled, createFiuuBookingPayment, createFiuuTopup } from "./providers/fiuu.js";

const stripe = config.stripeSecretKey ? new Stripe(config.stripeSecretKey) : null;
const usingFiuu = () => config.paymentProvider === "fiuu";

export const paymentsEnabled = () => (usingFiuu() ? fiuuEnabled() : !!stripe);
export const providerName = () => config.paymentProvider;

// Card vaulting exists only on Stripe (Fiuu's Recurring API is a separate
// enablement, not built yet) — under fiuu the apps hide the linked-card
// path because getSavedCard() returns null.
export const cardVaultAvailable = () => !usingFiuu() && !!stripe;

function requireStripe() {
  if (!stripe) {
    throw new HttpError(501, "payments_not_configured", "Card payments are not configured on this server");
  }
  return stripe;
}

const CURRENCY = "myr";
const toCents = (rm) => Math.round(rm * 100);

async function ensureCustomer(userId) {
  const s = requireStripe();
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new HttpError(404, "not_found", "User not found");
  if (user.stripeCustomerId) return user.stripeCustomerId;
  const customer = await s.customers.create({
    metadata: { lifelineUserId: user.id },
    ...(user.email ? { email: user.email } : {}),
  });
  await prisma.user.update({ where: { id: userId }, data: { stripeCustomerId: customer.id } });
  return customer.id;
}

// ── Patient: link a card (hosted Checkout, setup mode — zero card data
// touches our servers, works identically from app and web) ──
export async function createCardSetupSession(userId) {
  const s = requireStripe();
  const customer = await ensureCustomer(userId);
  const session = await s.checkout.sessions.create({
    mode: "setup",
    customer,
    currency: CURRENCY,
    payment_method_types: ["card"],
    success_url: `${config.publicApiUrl}/api/payments/return?outcome=card_linked`,
    cancel_url: `${config.publicApiUrl}/api/payments/return?outcome=cancelled`,
  });
  return { url: session.url };
}

// The patient's saved card, if any (brand + last4 only).
export async function getSavedCard(userId) {
  if (!cardVaultAvailable()) return null;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) return null;
  const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: "card", limit: 1 });
  const pm = methods.data[0];
  return pm ? { brand: pm.card.brand, last4: pm.card.last4 } : null;
}

export async function unlinkCard(userId) {
  const s = requireStripe();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (!user?.stripeCustomerId) return;
  const methods = await s.paymentMethods.list({ customer: user.stripeCustomerId, type: "card" });
  await Promise.all(methods.data.map((pm) => s.paymentMethods.detach(pm.id)));
}

// ── Card trip: charge the saved card off-session on completion. Returns
// { charged: true } or { charged: false, reason } — the caller falls back to
// the cash flow on failure and NEVER blocks trip completion. ──
export async function chargeBookingCard(booking) {
  if (!cardVaultAvailable()) return { charged: false, reason: "no_card_vault" };
  const user = await prisma.user.findUnique({
    where: { id: booking.userId },
    select: { stripeCustomerId: true },
  });
  if (!user?.stripeCustomerId) return { charged: false, reason: "no_customer" };
  const methods = await stripe.paymentMethods.list({ customer: user.stripeCustomerId, type: "card", limit: 1 });
  const pm = methods.data[0];
  if (!pm) return { charged: false, reason: "no_card" };

  try {
    const intent = await stripe.paymentIntents.create({
      amount: toCents(booking.total),
      currency: CURRENCY,
      customer: user.stripeCustomerId,
      payment_method: pm.id,
      off_session: true,
      confirm: true,
      description: `Lifeline trip ${booking.id} — ${booking.pickupName} → ${booking.destinationName}`,
      metadata: { bookingId: booking.id },
    });
    if (intent.status !== "succeeded") return { charged: false, reason: intent.status };
    return { charged: true, paymentIntentId: intent.id };
  } catch (err) {
    return { charged: false, reason: err.code || err.message };
  }
}

// ── Pay-first (decided 2026-08-04): prepaid bookings are paid BEFORE any
// operator sees them. Two payment paths share the same outcome:
//  a) linked card → charged off-session instantly at booking time
//     (chargeBookingCard above, called by the booking route);
//  b) hosted Checkout (card/FPX — DuitNow/TNG arrive with the future local
//     provider) → confirmBookingPayment verifies and triggers dispatch.

export async function createBookingPaymentSession(booking) {
  if (usingFiuu()) {
    const user = booking.userId
      ? await prisma.user.findUnique({ where: { id: booking.userId }, select: { name: true, email: true } })
      : null;
    return createFiuuBookingPayment(booking, user);
  }
  const s = requireStripe();
  const session = await s.checkout.sessions.create({
    mode: "payment",
    currency: CURRENCY,
    line_items: [
      {
        price_data: {
          currency: CURRENCY,
          product_data: {
            name: `Lifeline ambulance — ${booking.pickupName} → ${booking.destinationName}`,
          },
          unit_amount: toCents(booking.total),
        },
        quantity: 1,
      },
    ],
    metadata: { bookingId: booking.id, kind: "booking_payment" },
    success_url: `${config.publicApiUrl}/api/payments/booking/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.publicApiUrl}/api/payments/return?outcome=cancelled`,
  });
  return { url: session.url };
}

// Verifies a booking Checkout session with Stripe. Returns the bookingId and
// the payment-intent reference (stored as paymentRef so refunds work).
export async function confirmBookingPayment(sessionId) {
  const s = requireStripe();
  let session;
  try {
    session = await s.checkout.sessions.retrieve(sessionId);
  } catch {
    return { paid: false }; // unknown/garbled session id — not a server error
  }
  if (session.payment_status !== "paid" || session.metadata?.kind !== "booking_payment") {
    return { paid: false };
  }
  return {
    paid: true,
    bookingId: session.metadata.bookingId,
    paymentRef: typeof session.payment_intent === "string" ? session.payment_intent : session.payment_intent?.id,
    amountRm: session.amount_total / 100,
  };
}

// Full refund of a prepaid booking (no-operator expiry / cancellation).
// Caller is responsible for guarding idempotency via paymentStatus/refundedAt
// before calling; this just executes the provider refund.
export async function refundBookingPayment(booking) {
  if (usingFiuu()) {
    // Fiuu Refund API deliberately not wired until its spec is verified
    // against the sandbox — the engine logs this loudly and the refund is
    // processed manually in the Fiuu merchant portal for now.
    return { refunded: false, reason: "fiuu_refund_manual — process in the Fiuu portal" };
  }
  const s = requireStripe();
  if (!booking.paymentRef) return { refunded: false, reason: "no_payment_ref" };
  try {
    await s.refunds.create({ payment_intent: booking.paymentRef });
    return { refunded: true };
  } catch (err) {
    // Already-refunded intents are success from our point of view.
    if (err.code === "charge_already_refunded") return { refunded: true };
    return { refunded: false, reason: err.code || err.message };
  }
}

// ── Operator: self-serve wallet top-up via hosted Checkout (payment mode).
// Credited by confirmTopup below, idempotent per Checkout session. ──
export async function createTopupSession(operatorId, amountRm) {
  if (!Number.isFinite(amountRm) || amountRm < 10 || amountRm > 5000) {
    throw new HttpError(400, "invalid_amount", "Top-up must be between RM10 and RM5000");
  }
  if (usingFiuu()) {
    const operator = await prisma.operator.findUnique({
      where: { id: operatorId },
      select: { name: true, email: true },
    });
    return createFiuuTopup(operatorId, amountRm, operator);
  }
  const s = requireStripe();
  const session = await s.checkout.sessions.create({
    mode: "payment",
    currency: CURRENCY,
    line_items: [
      {
        price_data: {
          currency: CURRENCY,
          product_data: { name: "Lifeline wallet top-up" },
          unit_amount: toCents(amountRm),
        },
        quantity: 1,
      },
    ],
    metadata: { lifelineOperatorId: operatorId, kind: "wallet_topup" },
    success_url: `${config.publicApiUrl}/api/payments/topup/confirm?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${config.publicApiUrl}/api/payments/return?outcome=cancelled`,
  });
  return { url: session.url };
}

// Success-URL landing: verify with Stripe that the session is actually paid,
// then credit the wallet exactly once (ledger note carries the session id).
export async function confirmTopup(sessionId) {
  const s = requireStripe();
  let session;
  try {
    session = await s.checkout.sessions.retrieve(sessionId);
  } catch {
    return { credited: false }; // unknown/garbled session id — not a server error
  }
  if (session.payment_status !== "paid" || session.metadata?.kind !== "wallet_topup") {
    return { credited: false };
  }
  const operatorId = session.metadata.lifelineOperatorId;
  const already = await prisma.walletTransaction.findFirst({
    where: { operatorId, type: WALLET_TX_TYPE.TOPUP, note: { contains: sessionId } },
  });
  if (already) return { credited: true, duplicate: true };
  await applyWalletTransaction({
    operatorId,
    type: WALLET_TX_TYPE.TOPUP,
    amount: session.amount_total / 100,
    note: `Card top-up via Stripe (${sessionId})`,
  });
  return { credited: true };
}
