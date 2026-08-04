import { Router } from "express";
import { z } from "zod";
import { requirePatientAuth, requireOperatorAuth } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  paymentsEnabled,
  createCardSetupSession,
  getSavedCard,
  unlinkCard,
  createTopupSession,
  confirmTopup,
  confirmBookingPayment,
} from "../services/payment.js";
import { markBookingPaidAndDispatch } from "../services/offerEngine.js";

const router = Router();

// Tiny HTML landing for hosted-Checkout redirects — the user is in a browser
// tab at this point and just needs to go back to the app.
function landingPage(title, body) {
  return `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
<body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;background:#f5f8f8;color:#0F172E">
<div style="text-align:center;padding:24px"><h2>${title}</h2><p style="color:#5b6b73">${body}</p></div></body>`;
}

router.get("/status", (req, res) => res.json({ enabled: paymentsEnabled() }));

// ── Patient card management ──
router.post(
  "/card/setup",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    res.json(await createCardSetupSession(req.userId));
  })
);

router.get(
  "/card",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    res.json({ card: await getSavedCard(req.userId) });
  })
);

router.delete(
  "/card",
  requirePatientAuth,
  asyncHandler(async (req, res) => {
    await unlinkCard(req.userId);
    res.json({ ok: true });
  })
);

// ── Pay-first booking payment: hosted-Checkout success lands here. Verify
// with Stripe, then mark paid + start the operator race. Safe to reload —
// markBookingPaidAndDispatch is idempotent. ──
router.get(
  "/booking/confirm",
  asyncHandler(async (req, res) => {
    const result = await confirmBookingPayment(String(req.query.session_id || ""));
    if (!result.paid) {
      res.status(400).send(landingPage("Payment not completed", "Return to the Lifeline app to try again."));
      return;
    }
    await markBookingPaidAndDispatch(result.bookingId, result.paymentRef);
    res.send(
      landingPage("Payment received ✓", "We're finding your ambulance now — return to the Lifeline app.")
    );
  })
);

// ── Operator wallet top-up ──
const topupSchema = z.object({ amount: z.number().min(10).max(5000) });

router.post(
  "/topup",
  requireOperatorAuth,
  validate(topupSchema),
  asyncHandler(async (req, res) => {
    res.json(await createTopupSession(req.operatorId, req.body.amount));
  })
);

// Checkout success redirect — verifies with Stripe and credits exactly once.
// Idempotent: refreshing this page cannot double-credit.
router.get(
  "/topup/confirm",
  asyncHandler(async (req, res) => {
    const out = await confirmTopup(String(req.query.session_id || ""));
    res.send(
      out.credited
        ? landingPage("Top-up received ✓", "Your wallet has been credited. You can close this tab and return to the Lifeline Operator app.")
        : landingPage("Top-up not completed", "This payment wasn't completed. Return to the app and try again.")
    );
  })
);

router.get("/return", (req, res) => {
  const outcome = String(req.query.outcome || "");
  res.send(
    outcome === "card_linked"
      ? landingPage("Card linked ✓", "You can close this tab and return to the Lifeline app.")
      : landingPage("Cancelled", "No changes were made. You can close this tab and return to the app.")
  );
});

export default router;
