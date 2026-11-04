-- AlterTable
ALTER TABLE "Operator" ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "billingHold" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "billingHoldAt" TIMESTAMP(3),
ADD COLUMN     "billingHoldReason" TEXT,
ADD COLUMN     "subscriptionPrice" DOUBLE PRECISION;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "subscriptionDueDay" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "subscriptionGraceDays" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN     "subscriptionPrice" DOUBLE PRECISION NOT NULL DEFAULT 0;

