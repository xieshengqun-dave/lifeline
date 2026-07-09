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
  platformServiceFee: parseFloat(process.env.PLATFORM_SERVICE_FEE) || 15,
  adminApiToken: process.env.ADMIN_API_TOKEN || null,
  allowUnverifiedSocialAuth: process.env.ALLOW_UNVERIFIED_SOCIAL_AUTH === "true",
  googleClientId: process.env.GOOGLE_CLIENT_ID || null,
  appleClientId: process.env.APPLE_CLIENT_ID || null,
};
