-- CreateTable
CREATE TABLE "PaymentOrder" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "bookingId" TEXT,
    "operatorId" TEXT,
    "amountRm" DOUBLE PRECISION NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'fiuu',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "gatewayRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paidAt" TIMESTAMP(3),

    CONSTRAINT "PaymentOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymentOrder_bookingId_idx" ON "PaymentOrder"("bookingId");

-- CreateIndex
CREATE INDEX "PaymentOrder_operatorId_idx" ON "PaymentOrder"("operatorId");
