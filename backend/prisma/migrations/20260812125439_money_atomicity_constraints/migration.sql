-- Pre-cleanup: remove any duplicate settlement rows the old racy code could
-- have created (keep the earliest per (bookingId, type)) so the unique
-- constraint can apply. Balance drift from removed dupes is a dev-data
-- concern; production has had single-completion flows only.
DELETE FROM "WalletTransaction" a
USING "WalletTransaction" b
WHERE a."bookingId" IS NOT NULL
  AND a."bookingId" = b."bookingId"
  AND a."type" = b."type"
  AND a."createdAt" > b."createdAt";

-- AlterTable
ALTER TABLE "WalletTransaction" ADD COLUMN     "orderRef" TEXT;

-- CreateIndex
CREATE INDEX "BookingOffer_status_expiresAt_idx" ON "BookingOffer"("status", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_orderRef_key" ON "WalletTransaction"("orderRef");

-- CreateIndex
CREATE UNIQUE INDEX "WalletTransaction_bookingId_type_key" ON "WalletTransaction"("bookingId", "type");
