import { Router } from "express";
import { z } from "zod";
import bcrypt from "bcryptjs";
import { prisma } from "../lib/prisma.js";
import { config } from "../lib/env.js";
import { signToken, requirePatientAuth } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler, HttpError } from "../middleware/errorHandler.js";
import { AUTH_PROVIDER } from "../lib/constants.js";

const router = Router();

// `email` is required (not just optional) because in ALLOW_UNVERIFIED_SOCIAL_AUTH
// dev mode it's used as a stand-in for the provider's real `sub` identity —
// see socialAuthHandler below.
const socialAuthSchema = z.object({
  providerToken: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email(),
});

const upgradeSchema = z.object({
  provider: z.enum([AUTH_PROVIDER.GOOGLE, AUTH_PROVIDER.APPLE]),
  providerToken: z.string().optional(),
  name: z.string().optional(),
  email: z.string().email(),
});

const operatorLoginSchema = z.object({
  // Normalised so a trailing space or capital from a phone keyboard still
  // logs in (seeded/stored operator emails are lowercase).
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post(
  "/guest",
  asyncHandler(async (_req, res) => {
    const user = await prisma.user.create({ data: { authProvider: AUTH_PROVIDER.GUEST, isGuest: true } });
    const token = signToken({ role: "patient", userId: user.id });
    res.status(201).json({ token, user: { id: user.id, isGuest: true } });
  })
);

// Real Google/Apple token verification is a TODO(human) — needs real
// GOOGLE_CLIENT_ID/APPLE_CLIENT_ID from real developer accounts (see
// .env.example). Until then this returns 501, unless ALLOW_UNVERIFIED_SOCIAL_AUTH
// is set for local dev, in which case the client-supplied identity is
// trusted without verification (loudly flagged, never silent).
function socialAuthHandler(provider) {
  return asyncHandler(async (req, res) => {
    if (!config.allowUnverifiedSocialAuth) {
      throw new HttpError(501, "not_configured", `${provider} sign-in verification not yet configured — see README`);
    }
    console.warn(`[auth] UNVERIFIED ${provider} sign-in accepted (dev mode) for email=${req.body.email}`);

    const providerId = req.body.email; // dev-only stand-in for the provider's real `sub`
    const user = await prisma.user.upsert({
      where: { authProvider_providerId: { authProvider: provider, providerId } },
      update: { name: req.body.name, email: req.body.email },
      create: {
        authProvider: provider,
        providerId,
        isGuest: false,
        name: req.body.name,
        email: req.body.email,
      },
    });

    const token = signToken({ role: "patient", userId: user.id });
    res.json({ token, user: { id: user.id, isGuest: false }, devModeUnverified: true });
  });
}

router.post("/google", validate(socialAuthSchema), socialAuthHandler(AUTH_PROVIDER.GOOGLE));
router.post("/apple", validate(socialAuthSchema), socialAuthHandler(AUTH_PROVIDER.APPLE));

router.post(
  "/upgrade",
  requirePatientAuth,
  validate(upgradeSchema),
  asyncHandler(async (req, res) => {
    if (!config.allowUnverifiedSocialAuth) {
      throw new HttpError(501, "not_configured", "Social sign-in verification not yet configured — see README");
    }
    console.warn(`[auth] UNVERIFIED ${req.body.provider} upgrade accepted (dev mode) for user=${req.userId}`);

    const user = await prisma.user.update({
      where: { id: req.userId },
      data: {
        authProvider: req.body.provider,
        providerId: req.body.email,
        isGuest: false,
        guestUpgradedAt: new Date(),
        name: req.body.name,
        email: req.body.email,
      },
    });

    const token = signToken({ role: "patient", userId: user.id });
    res.json({ token, user: { id: user.id, isGuest: false } });
  })
);

const pushTokenSchema = z.object({
  // Expo push token, e.g. ExponentPushToken[xxxx]; null clears it (sign-out /
  // permission revoked).
  pushToken: z.string().max(200).regex(/^Expo(nent)?PushToken\[.+\]$/).nullable(),
});

router.post(
  "/push-token",
  requirePatientAuth,
  validate(pushTokenSchema),
  asyncHandler(async (req, res) => {
    await prisma.user.update({ where: { id: req.userId }, data: { pushToken: req.body.pushToken } });
    res.json({ ok: true });
  })
);

router.post(
  "/operator/login",
  validate(operatorLoginSchema),
  asyncHandler(async (req, res) => {
    const operator = await prisma.operator.findUnique({ where: { email: req.body.email } });
    const valid = operator && (await bcrypt.compare(req.body.password, operator.passwordHash));
    if (!valid) throw new HttpError(401, "invalid_credentials", "Invalid email or password");

    const token = signToken({ role: "operator", operatorId: operator.id });
    res.json({ token, operator: { id: operator.id, name: operator.name } });
  })
);

// ── Admin login (AdminUser accounts, added 2026-09-18) ──
// Repeated wrong passwords lock an account's login for a few minutes: this
// endpoint is public and would otherwise be guessable at HTTP speed. In
// memory on purpose — one API instance today, and a restart clearing the
// counter is an acceptable trade for not adding a table.
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const failures = new Map(); // email -> { count, until }

function lockoutRemainingMs(email) {
  const f = failures.get(email);
  if (!f?.until) return 0;
  if (f.until <= Date.now()) {
    failures.delete(email);
    return 0;
  }
  return f.until - Date.now();
}

function recordFailure(email) {
  const f = failures.get(email) || { count: 0, until: 0 };
  f.count += 1;
  if (f.count >= MAX_ATTEMPTS) {
    f.until = Date.now() + LOCKOUT_MS;
    f.count = 0;
  }
  failures.set(email, f);
}

const adminLoginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1),
});

router.post(
  "/admin/login",
  validate(adminLoginSchema),
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    const waitMs = lockoutRemainingMs(email);
    if (waitMs > 0) {
      throw new HttpError(
        429,
        "too_many_attempts",
        `Too many failed attempts — try again in ${Math.ceil(waitMs / 60000)} minute(s)`
      );
    }

    const admin = await prisma.adminUser.findUnique({ where: { email } });
    // Same 401 for unknown email, wrong password and disabled account — a
    // login form must not reveal which admin emails exist.
    const valid = admin && !admin.disabledAt && (await bcrypt.compare(password, admin.passwordHash));
    if (!valid) {
      recordFailure(email);
      throw new HttpError(401, "invalid_credentials", "Invalid email or password");
    }

    failures.delete(email);
    await prisma.adminUser.update({ where: { id: admin.id }, data: { lastLoginAt: new Date() } });
    const token = signToken({ role: "admin", adminUserId: admin.id });
    res.json({ token, admin: { id: admin.id, email: admin.email, name: admin.name } });
  })
);

export default router;
