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
  email: z.string().email(),
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

export default router;
