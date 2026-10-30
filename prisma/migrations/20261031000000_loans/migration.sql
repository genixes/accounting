-- CreateTable
CREATE TABLE "Loan" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "lender" TEXT NOT NULL,
    "principal" DECIMAL(18,2) NOT NULL,
    "annualRate" DECIMAL(8,6) NOT NULL,
    "termYears" INTEGER NOT NULL,
    "paymentsPerYear" INTEGER NOT NULL DEFAULT 12,
    "startDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Loan_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Loan_propertyId_idx" ON "Loan"("propertyId");

-- AddForeignKey
ALTER TABLE "Loan" ADD CONSTRAINT "Loan_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RealProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

