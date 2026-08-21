// Loaded first, before any other module touches process.env — Prisma Client
// happens to auto-load backend/.env on import, but non-Prisma vars below
// (JWT_SECRET etc.) shouldn't depend on that incidental behavior or import
// order, so we load explicitly here too.
import "dotenv/config";

const required = ["DATABASE_URL", "JWT_SECRET"];
const missing = required.filter((key) => !process.env[key]);
if (missing.length) {
  throw new Error(`Missing required env var(s): ${missing.join(", ")}`);
}

export const config = {
  port: parseInt(process.env.PORT, 10) || 4000,
  databaseUrl: process.env.DATABASE_URL,
  jwtSecret: process.env.JWT_SECRET,
  offerTimeoutSeconds: parseInt(process.env.OFFER_TIMEOUT_SECONDS, 10) || 60,
  offerSweepIntervalSeconds: parseInt(process.env.OFFER_SWEEP_INTERVAL_SECONDS, 10) || 15,
  // Failed provider refunds (e.g. e-wallet charge not yet confirmed — T+2
  // for TNG) are retried on this interval until they clear.
  refundRetryIntervalMinutes: parseFloat(process.env.REFUND_RETRY_INTERVAL_MINUTES) || 60,
  platformServiceFee: parseFloat(process.env.PLATFORM_SERVICE_FEE) || 15,
  adminApiToken: process.env.ADMIN_API_TOKEN || null,
  allowUnverifiedSocialAuth: process.env.ALLOW_UNVERIFIED_SOCIAL_AUTH === "true",
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  appleClientId: process.env.APPLE_CLIENT_ID || null,
  // Payment provider switch: "stripe" (default, reference implementation),
  // "fiuu" or "hitpay" (Malaysian gateways — TNG/DuitNow/FPX/cards via
  // hosted page).
  paymentProvider: ["fiuu", "hitpay"].includes(process.env.PAYMENT_PROVIDER)
    ? process.env.PAYMENT_PROVIDER
    : "stripe",
  // Stripe (test keys during the build; live keys are a human go-live
  // decision). Optional: card features 501 cleanly when absent.
  stripeSecretKey: process.env.STRIPE_SECRET_KEY || null,
  // Fiuu credentials (sandbox first — Dev account from fiuu.com).
  fiuuMerchantId: process.env.FIUU_MERCHANT_ID || null,
  fiuuVerifyKey: process.env.FIUU_VERIFY_KEY || null,
  fiuuSecretKey: process.env.FIUU_SECRET_KEY || null,
  fiuuSandbox: process.env.FIUU_SANDBOX !== "false", // default sandbox until go-live
  // HitPay credentials (API key + salt from Dashboard → Settings → API Keys;
  // the sandbox at sandbox.hit-pay.com is self-serve).
  hitpayApiKey: process.env.HITPAY_API_KEY || null,
  hitpaySalt: process.env.HITPAY_SALT || null,
  hitpaySandbox: process.env.HITPAY_SANDBOX !== "false", // default sandbox until go-live
  // Test hook: point the HitPay client at a mock server. Never set in prod.
  hitpayApiBase: process.env.HITPAY_API_BASE || null,
  // Where hosted Checkout sends the browser back to (the API renders a tiny
  // "return to the app" page). Defaults to localhost for dev.
  publicApiUrl: process.env.PUBLIC_API_URL || `http://localhost:${parseInt(process.env.PORT, 10) || 4000}`,
};
