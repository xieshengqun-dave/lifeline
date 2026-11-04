import { prisma } from "../lib/prisma.js";
import { config } from "../lib/env.js";

const SETTINGS_ID = 1;

// One fetch of the singleton row yields every setting — use this wherever a
// code path needs two or more settings (the per-field getters below each
// cost a query, which tripled up on the dispatch hot path — review cleanup
// 2026-08-07).
export async function getAllSettings() {
  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  return {
    offerTimeoutSeconds: row?.offerTimeoutSeconds ?? config.offerTimeoutSeconds,
    subscription: toSubscription(row),
  };
}

// Admin-set operator accept window (seconds). Falls back to the
// OFFER_TIMEOUT_SECONDS env default when unset. Applies at offer-creation
// time only — in-flight offers keep their persisted expiresAt.
export async function getOfferTimeoutSeconds() {
  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  return row?.offerTimeoutSeconds ?? config.offerTimeoutSeconds;
}

export async function updateOfferTimeoutSeconds(seconds) {
  const row = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { offerTimeoutSeconds: seconds },
    create: { id: SETTINGS_ID, offerTimeoutSeconds: seconds },
  });
  return { offerTimeoutSeconds: row.offerTimeoutSeconds };
}

// SaaS subscription (2026-11-04): operators pay Lifeline a monthly
// subscription, charged in advance on the 1st, due on dueDay, paused when
// still unpaid graceDays after that. Replaced the per-trip platform fee, the
// minimum wallet balance and the credit limit (their DB columns are unused).
const toSubscription = (row) => ({
  price: row?.subscriptionPrice ?? 0,
  dueDay: row?.subscriptionDueDay ?? 7,
  graceDays: row?.subscriptionGraceDays ?? 7,
});

export async function getSubscriptionSettings() {
  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  return toSubscription(row);
}

export async function updateSubscriptionSettings({ price, dueDay, graceDays }) {
  const data = { subscriptionPrice: price, subscriptionDueDay: dueDay, subscriptionGraceDays: graceDays };
  const row = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
  return toSubscription(row);
}

// Where operators pay their monthly bill. Every field optional — the
// operator app shows whatever the admin has filled in.
const BILLING_FIELDS = [
  "billingAccountName",
  "billingBankName",
  "billingAccountNumber",
  "billingInstructions",
  "billingQrImage",
];

const toPayTo = (row) => ({
  accountName: row?.billingAccountName ?? null,
  bankName: row?.billingBankName ?? null,
  accountNumber: row?.billingAccountNumber ?? null,
  instructions: row?.billingInstructions ?? null,
  qrImage: row?.billingQrImage ?? null,
});

export async function getBillingPayTo() {
  const row = await prisma.platformSettings.findUnique({
    where: { id: SETTINGS_ID },
    select: Object.fromEntries(BILLING_FIELDS.map((f) => [f, true])),
  });
  return toPayTo(row);
}

export async function updateBillingPayTo({ accountName, bankName, accountNumber, instructions, qrImage }) {
  const data = {
    billingAccountName: accountName,
    billingBankName: bankName,
    billingAccountNumber: accountNumber,
    billingInstructions: instructions,
    billingQrImage: qrImage,
  };
  const row = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: data,
    create: { id: SETTINGS_ID, ...data },
  });
  return toPayTo(row);
}
