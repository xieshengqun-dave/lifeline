-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "walletBalance" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "WalletTransaction" (
    "id" TEXT NOT NULL,
    "operatorId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "balanceAfter" DOUBLE PRECISION NOT NULL,
    "bookingId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WalletTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WalletTransaction_operatorId_createdAt_idx" ON "WalletTransaction"("operatorId", "createdAt");

-- AddForeignKey
ALTER TABLE "WalletTransaction" ADD CONSTRAINT "WalletTransaction_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Starter float for operators that existed before the wallet: RM100 credit
-- so fee-gating doesn't instantly block every operator on deploy. Recorded
-- honestly in the ledger as an adjustment.
UPDATE "Operator" SET "walletBalance" = 100;
INSERT INTO "WalletTransaction" ("id", "operatorId", "type", "amount", "balanceAfter", "note")
SELECT 'wtx_seed_' || "id", "id", 'adjustment', 100, 100, 'Pilot starter credit (granted at wallet launch)'
FROM "Operator";
