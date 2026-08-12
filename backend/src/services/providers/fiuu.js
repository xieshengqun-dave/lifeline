import crypto from "crypto";
import { prisma } from "../../lib/prisma.js";
import { config } from "../../lib/env.js";
import { HttpError } from "../../middleware/errorHandler.js";

// Fiuu (ex-MOLPay / Razer Merchant Services) hosted-payment integration.
// The patient/operator is redirected to Fiuu's page, which presents every
// channel enabled on the merchant account (TNG eWallet, DuitNow QR, FPX,
// cards) — we never touch payment instruments.
//
// Signature scheme (stable across the MOLPay→RMS→Fiuu rebrands; verify
// against the sandbox before go-live):
//   request  vcode = md5(amount + merchantId + orderid + verifyKey)
//   response skey  = md5(paydate + domain + key0 + appcode + secretKey)
//            key0  = md5(tranID + orderid + status + domain + amount + currency)
// The notification/return handlers recompute skey with our secret — a valid
// signature can only come from Fiuu. Amounts are additionally checked
// against our own PaymentOrder row, never trusted from the POST.
//
// NOT implemented yet (deliberately, pending sandbox verification):
// tokenized cards (Fiuu Recurring API — separate enablement) and the Refund
// API. Refunds under fiuu are flagged for manual processing in the portal.

const md5 = (s) => crypto.createHash("md5").update(s).digest("hex");

export const fiuuEnabled = () =>
  !!(config.fiuuMerchantId && config.fiuuVerifyKey && config.fiuuSecretKey);

const payBase = () =>
  config.fiuuSandbox ? "https://sandbox.merchant.razer.com" : "https://pay.fiuu.com";

function requireFiuu() {
  if (!fiuuEnabled()) {
    throw new HttpError(501, "payments_not_configured", "Fiuu is not configured on this server");
  }
}

function hostedPayUrl(order, { name, email, mobile, description }) {
  const amount = order.amountRm.toFixed(2);
  const vcode = md5(amount + config.fiuuMerchantId + order.id + config.fiuuVerifyKey);
  const params = new URLSearchParams({
    amount,
    orderid: order.id,
    bill_name: name || "Lifeline User",
    bill_email: email || "noreply@lifeline.example",
    bill_mobile: mobile || "0000000000",
    bill_desc: description.slice(0, 100),
    country: "MY",
    currency: "MYR",
    returnurl: `${config.publicApiUrl}/api/payments/fiuu/return`,
    callbackurl: `${config.publicApiUrl}/api/payments/fiuu/notify`,
    vcode,
  });
  return `${payBase()}/RMS/pay/${config.fiuuMerchantId}/?${params.toString()}`;
}

export async function createFiuuBookingPayment(booking, user) {
  requireFiuu();
  const order = await prisma.paymentOrder.create({
    data: { kind: "booking_payment", bookingId: booking.id, amountRm: booking.total },
  });
  return {
    url: hostedPayUrl(order, {
      name: user?.name,
      email: user?.email,
      description: `Lifeline ambulance ${booking.pickupName} -> ${booking.destinationName}`,
    }),
  };
}

export async function createFiuuTopup(operatorId, amountRm, operator) {
  requireFiuu();
  const order = await prisma.paymentOrder.create({
    data: { kind: "wallet_topup", operatorId, amountRm },
  });
  return {
    url: hostedPayUrl(order, {
      name: operator?.name,
      email: operator?.email,
      description: "Lifeline wallet top-up",
    }),
  };
}

// Verifies a Fiuu response POST (return URL and notification share the same
// shape). Returns { ok, order, tranID, paid } — `ok:false` means the
// signature or amount didn't hold and the caller must treat it as hostile.
export async function verifyFiuuResponse(body) {
  requireFiuu();
  const { amount, orderid, tranID, domain, status, appcode = "", paydate, skey, currency = "MYR" } = body || {};
  if (!orderid || !skey || !tranID) return { ok: false };

  const key0 = md5(String(tranID) + orderid + status + domain + amount + currency);
  const expected = md5(String(paydate) + domain + key0 + appcode + config.fiuuSecretKey);
  if (expected !== skey) {
    console.error(`fiuu: skey mismatch for order ${orderid} — rejecting`);
    return { ok: false };
  }

  const order = await prisma.paymentOrder.findUnique({ where: { id: orderid } });
  if (!order) return { ok: false };
  // Amount must match OUR record to the sen — never trust the POST's number.
  if (Number(amount).toFixed(2) !== order.amountRm.toFixed(2)) {
    console.error(`fiuu: amount mismatch for order ${orderid} (${amount} vs ${order.amountRm}) — rejecting`);
    return { ok: false };
  }
  return { ok: true, order, tranID: String(tranID), paid: status === "00" };
}
