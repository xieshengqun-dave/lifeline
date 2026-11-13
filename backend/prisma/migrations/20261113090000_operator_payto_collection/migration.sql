-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "collectedAt" TIMESTAMP(3),
ADD COLUMN     "collectedVia" TEXT;

-- CreateTable
CREATE TABLE "OperatorPayTo" (
    "operatorId" TEXT NOT NULL,
    "accountName" TEXT,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "instructions" TEXT,
    "qrImage" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OperatorPayTo_pkey" PRIMARY KEY ("operatorId")
);

-- AddForeignKey
ALTER TABLE "OperatorPayTo" ADD CONSTRAINT "OperatorPayTo_operatorId_fkey" FOREIGN KEY ("operatorId") REFERENCES "Operator"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

