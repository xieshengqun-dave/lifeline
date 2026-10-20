-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "billingAccountName" TEXT,
ADD COLUMN     "billingAccountNumber" TEXT,
ADD COLUMN     "billingBankName" TEXT,
ADD COLUMN     "billingInstructions" TEXT,
ADD COLUMN     "billingQrImage" TEXT,
ADD COLUMN     "creditLimit" DOUBLE PRECISION NOT NULL DEFAULT 0;

