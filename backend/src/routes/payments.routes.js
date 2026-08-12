import { Router } from "express";
import { z } from "zod";
import { requirePatientAuth, requireOperatorAuth } from "../lib/auth.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import {
  paymentsEnabled,
  providerName,
  cardVaultAvailable,
  createCardSetupSession,
  getSavedCard,
  unlinkCard,
  createTopupSession,
  confirmTopup,
  confirmBookingPayment,
  TOPUP_MIN_RM,
  TOPUP_MAX_RM,
} from "../services/payment.js";
import { markBookingPaidAndDispatch } from "../services/offerEngine.js";
import { verifyFiuuResponse, settleFiuuOrder } from "../services/providers/fiuu.js";
import { applyWalletTransaction, WALLET_TX_TYPE, isDuplicateMovement } from "../services/wallet.js";
import { prisma } from "../lib/prisma.js";

const router = Router();

// Tiny HTML landing for hosted-Checkout redirects. When appScheme is given
// (lifeline / lifeline-operator) the page immediately tries to deep-link
// back into the app — the foregrounding alone is what makes the app's
// server-sync catch up instantly. A visible button covers browsers that
// block automatic scheme navigation.
function landingPage(title, body, appScheme) {
  const link = appScheme ? `${appScheme}://payment-return` : null;
  return `<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1">
<body style="font-family:system-ui;display:grid;place-items:center;min-height:90vh;background:#f5f8f8;color:#0F172E">
<div style="text-align:center;padding:24px">
<h2>${title}</h2><p style="color:#5b6b73">${body}</p>
${link ? `<a href="${link}" style="display:inline-block;margin-top:14px;padding:14px 34px;border-radius:14px;background:linear-gradient(135deg,#1f8a8f,#12545c);color:#fff;text-decoration:none;font-weight:700">Open Lifeline</a>
<script>setTimeout(function(){ location.href = ${JSON.stringify(link)}; }, 400);</script>` : ""}
</div></body>`;
}

router.get("/status", (req, res) =>
  res.json({ enabled: paymentsEnabled(), provider: providerName(), cardVault: cardVaultAvailable() })
);

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
      res.status(400).send(landingPage("Payment not completed", "Return to the Lifeline app to try again.", "lifeline"));
      return;
    }
    await markBookingPaidAndDispatch(result.bookingId, result.paymentRef, "stripe");
    res.send(
      landingPage("Payment received ✓", "We're finding your ambulance now — sending you back to the app…", "lifeline")
    );
  })
);

// ── Fiuu (Malaysian gateway): return + notification handlers. Both verify
// the skey signature and settle idempotently; the notification URL is the
// authoritative channel (per Fiuu's own guidance), the return URL is the
// user-facing one that also settles when it beat the notification (e.g.
// local dev, where Fiuu's servers can't reach us). ──
async function settleVerifiedFiuu(verified) {
  if (!verified.paid) return { settled: false };
  const fresh = await settleFiuuOrder(verified.order, verified.tranID);
  if (!fresh) return { settled: true, duplicate: true }; // already processed
  // If the effect fails AFTER the order CAS'd to paid, revert the order to
  // pending and rethrow — Fiuu's retry (or the payer reloading the return
  // page) then reprocesses instead of being swallowed as a duplicate, so a
  // real payment can never be silently lost (review finding 2026-08-06).
  try {
    if (fresh.kind === "booking_payment") {
      await markBookingPaidAndDispatch(fresh.bookingId, `fiuu:${verified.tranID}`, "fiuu");
    } else if (fresh.kind === "wallet_topup") {
      try {
        await applyWalletTransaction({
          operatorId: fresh.operatorId,
          type: WALLET_TX_TYPE.TOPUP,
          amount: fresh.amountRm,
          orderRef: fresh.id, // UNIQUE — DB-level once-only credit
          note: `Top-up via Fiuu (${fresh.id} / ${verified.tranID})`,
        });
      } catch (err) {
        if (!isDuplicateMovement(err)) throw err;
      }
    }
  } catch (err) {
    console.error(`fiuu settle effect failed for order ${fresh.id} — reverting to pending for retry:`, err);
    await prisma.paymentOrder
      .updateMany({ where: { id: fresh.id, status: "paid" }, data: { status: "pending", gatewayRef: null, paidAt: null } })
      .catch((revertErr) => console.error(`CRITICAL: could not revert order ${fresh.id} — reconcile manually:`, revertErr));
    throw err;
  }
  return { settled: true };
}

router.post(
  "/fiuu/notify",
  asyncHandler(async (req, res) => {
    const verified = await verifyFiuuResponse(req.body);
    if (verified.ok) await settleVerifiedFiuu(verified);
    // Fiuu's callback ACK token — always respond so it stops retrying;
    // invalid posts were rejected above and logged.
    res.type("text/plain").send("CBTOKEN:MPSTATOK");
  })
);

// Fiuu posts form data to the return URL via the payer's browser.
router.post(
  "/fiuu/return",
  asyncHandler(async (req, res) => {
    const verified = await verifyFiuuResponse(req.body);
    if (!verified.ok) {
      res.status(400).send(landingPage("Payment could not be verified", "Return to the Lifeline app and check your booking."));
      return;
    }
    await settleVerifiedFiuu(verified);
    // Deep-link back into the right app by order kind — parity with the
    // Stripe pages (review finding 2026-08-06).
    const scheme = verified.order.kind === "wallet_topup" ? "lifeline-operator" : "lifeline";
    res.send(
      verified.paid
        ? landingPage("Payment received ✓", "Sending you back to the app…", scheme)
        : landingPage("Payment not completed", "Return to the Lifeline app to try again.", scheme)
    );
  })
);

// ── Operator wallet top-up ──
const topupSchema = z.object({ amount: z.number().min(TOPUP_MIN_RM).max(TOPUP_MAX_RM) });

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
        ? landingPage("Top-up received ✓", "Your wallet has been credited — sending you back to the app…", "lifeline-operator")
        : landingPage("Top-up not completed", "This payment wasn't completed. Return to the app and try again.", "lifeline-operator")
    );
  })
);

router.get("/return", (req, res) => {
  const outcome = String(req.query.outcome || "");
  res.send(
    outcome === "card_linked"
      ? landingPage("Card linked ✓", "Sending you back to the app…", "lifeline")
      : landingPage("Cancelled", "No changes were made. You can close this tab and return to the app.")
  );
});

export default router;
