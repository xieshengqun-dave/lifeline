import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { config } from "../../lib/env.js";
import { HttpError } from "../../middleware/errorHandler.js";

// HitPay hosted-payment integration (Malaysia: TNG eWallet, DuitNow QR, FPX,
// cards, GrabPay/Boost — whatever is enabled on the merchant account). The
// payer is redirected to HitPay's checkout URL; we never touch payment
// instruments.
//
// API (docs.hitpayapp.com, verified 2026-08-12):
//   create  POST {base}/v1/payment-requests   header X-BUSINESS-API-KEY
//           -> { id, url, status }
//   status  GET  {base}/v1/payment-requests/{id}
//   refund  POST {base}/v1/refund  { payment_id, amount }
//   callback: form-encoded POST to our `webhook` URL with payment_id,
//           payment_request_id, reference_number, amount, currency, status,
//           hmac. Verify: drop hmac, sort keys, concat key+value pairs,
//           HMAC-SHA256 with the API-key salt.
// reference_number carries OUR PaymentOrder id — amounts are re-checked
// against that row, never trusted from the POST.

export const hitpayEnabled = () => !!(config.hitpayApiKey && config.hitpaySalt);

const apiBase = () =>
  config.hitpayApiBase ||
  (config.hitpaySandbox ? "https://api.sandbox.hit-pay.com/v1" : "https://api.hit-pay.com/v1");

function requireHitpay() {
  if (!hitpayEnabled()) {
    throw new HttpError(501, "payments_not_configured", "HitPay is not configured on this server");
  }
}

async function hitpayRequest(method, path, body) {
  const res = await fetch(`${apiBase()}${path}`, {
    method,
    headers: {
      "X-BUSINESS-API-KEY": config.hitpayApiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new HttpError(502, "gateway_error", `HitPay ${method} ${path} failed (${res.status}): ${text.slice(0, 300)}`);
  }
  return res.json();
}

// Creates a HitPay payment request for an existing PaymentOrder and returns
// the hosted checkout URL. The request id is stored on the order's
// gatewayRef while pending (settle overwrites it with the payment id).
async function createPaymentRequest(order, { name, email, purpose }) {
  const data = await hitpayRequest("POST", "/payment-requests", {
    amount: order.amountRm.toFixed(2),
    currency: "MYR",
    reference_number: order.id,
    purpose: purpose.slice(0, 255),
    ...(name ? { name } : {}),
    ...(email ? { email } : {}),
    redirect_url: `${config.publicApiUrl}/api/payments/hitpay/return?order=${order.id}`,
    webhook: `${config.publicApiUrl}/api/payments/hitpay/notify`,
    send_email: false,
    send_sms: false,
  });
  await prisma.paymentOrder.update({ where: { id: order.id }, data: { gatewayRef: `req:${data.id}` } });
  return { url: data.url };
}

export async function createHitpayBookingPayment(booking, user) {
  requireHitpay();
  const order = await prisma.paymentOrder.create({
    data: { kind: "booking_payment", bookingId: booking.id, amountRm: booking.total, provider: "hitpay" },
  });
  return createPaymentRequest(order, {
    name: user?.name,
    email: user?.email,
    purpose: `Lifeline ambulance ${booking.pickupName} -> ${booking.destinationName}`,
  });
}

export async function createHitpayTopup(operatorId, amountRm, operator) {
  requireHitpay();
  const order = await prisma.paymentOrder.create({
    data: { kind: "wallet_topup", operatorId, amountRm, provider: "hitpay" },
  });
  return createPaymentRequest(order, {
    name: operator?.name,
    email: operator?.email,
    purpose: "Lifeline wallet top-up",
  });
}

// Verifies a HitPay callback POST (form-encoded). Returns { ok, order,
// paymentId, paid } — `ok:false` means the signature, order, or amount
// didn't hold and the caller must treat it as hostile.
export async function verifyHitpayCallback(body) {
  requireHitpay();
  const { hmac, ...fields } = body || {};
  const orderid = fields.reference_number;
  if (!hmac || !orderid || !fields.payment_id) return { ok: false };

  const source = Object.keys(fields)
    .sort()
    .map((k) => `${k}${fields[k]}`)
    .join("");
  const expected = crypto.createHmac("sha256", config.hitpaySalt).update(source).digest("hex");
  const a = Buffer.from(String(hmac));
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    console.error(`hitpay: hmac mismatch for order ${orderid} — rejecting`);
    return { ok: false };
  }

  const order = await prisma.paymentOrder.findUnique({ where: { id: orderid } });
  if (!order) return { ok: false };
  // Amount must match OUR record to the sen — never trust the POST's number.
  if (Number(fields.amount).toFixed(2) !== order.amountRm.toFixed(2)) {
    console.error(`hitpay: amount mismatch for order ${orderid} (${fields.amount} vs ${order.amountRm}) — rejecting`);
    return { ok: false };
  }
  return { ok: true, order, paymentId: String(fields.payment_id), paid: fields.status === "completed" };
}

// Full refund of a completed HitPay payment. Only full refunds for v1 (same
// policy as Stripe). Sandbox-verify before go-live.
export async function refundHitpayPayment(paymentId, amountRm) {
  requireHitpay();
  try {
    await hitpayRequest("POST", "/refund", { payment_id: paymentId, amount: amountRm.toFixed(2) });
    return { refunded: true };
  } catch (err) {
    // HitPay allows one refund per payment — a repeat attempt failing is
    // success from our point of view only if it was already refunded, which
    // we can't distinguish from the error alone; surface it for manual review.
    return { refunded: false, reason: err.message };
  }
}
