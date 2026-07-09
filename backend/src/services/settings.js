import { prisma } from "../lib/prisma.js";
import { config } from "../lib/env.js";
import { PLATFORM_FEE_TYPE } from "../lib/constants.js";

const SETTINGS_ID = 1;

// No row present (fresh DB, no admin has ever changed it) falls back live to
// the pre-existing PLATFORM_SERVICE_FEE env var — preserves today's exact
// behavior with no migration backfill needed.
export async function getPlatformFeeSetting() {
  const row = await prisma.platformSettings.findUnique({ where: { id: SETTINGS_ID } });
  if (row) return { feeType: row.feeType, feeValue: row.feeValue };
  return { feeType: PLATFORM_FEE_TYPE.FLAT, feeValue: config.platformServiceFee };
}

export async function updatePlatformFeeSetting({ feeType, feeValue }) {
  const row = await prisma.platformSettings.upsert({
    where: { id: SETTINGS_ID },
    update: { feeType, feeValue },
    create: { id: SETTINGS_ID, feeType, feeValue },
  });
  return { feeType: row.feeType, feeValue: row.feeValue };
}

export function resolveFeeAmount(setting, subtotal) {
  if (setting.feeType === PLATFORM_FEE_TYPE.PERCENT) {
    return Math.round(subtotal * (setting.feeValue / 100) * 100) / 100;
  }
  return setting.feeValue;
}
