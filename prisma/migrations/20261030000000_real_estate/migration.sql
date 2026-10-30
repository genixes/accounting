-- CreateEnum
CREATE TYPE "Vertical" AS ENUM ('CONSTRUCTION', 'REAL_ESTATE');

-- CreateEnum
CREATE TYPE "InvestorMode" AS ENUM ('SOLO', 'SYNDICATION');

-- CreateEnum
CREATE TYPE "PropertyType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'INDUSTRIAL', 'LAND', 'MIXED_USE');

-- CreateEnum
CREATE TYPE "PropertyStage" AS ENUM ('PROSPECT', 'UNDER_CONTRACT', 'OWNED', 'LEASED', 'HELD', 'LISTED', 'SOLD');

-- CreateEnum
CREATE TYPE "LedgerAccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'INCOME', 'EXPENSE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "baseCurrency" TEXT NOT NULL DEFAULT 'PHP',
ADD COLUMN     "investorMode" "InvestorMode",
ADD COLUMN     "vertical" "Vertical" NOT NULL DEFAULT 'CONSTRUCTION';

-- CreateTable
CREATE TABLE "RealProperty" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "PropertyType" NOT NULL,
    "stage" "PropertyStage" NOT NULL DEFAULT 'PROSPECT',
    "currency" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "country" TEXT,
    "purchasePrice" DECIMAL(18,2),
    "purchaseDate" TIMESTAMP(3),
    "closingCosts" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "currentValue" DECIMAL(18,2),
    "salePrice" DECIMAL(18,2),
    "soldDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RealProperty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyStageEvent" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "fromStage" "PropertyStage",
    "toStage" "PropertyStage" NOT NULL,
    "byName" TEXT NOT NULL,
    "note" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PropertyStageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Unit" (
    "id" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "marketRent" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lease" (
    "id" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "tenantName" TEXT NOT NULL,
    "monthlyRent" DECIMAL(18,2) NOT NULL,
    "deposit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "endedAt" TIMESTAMP(3),

    CONSTRAINT "Lease_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Investor" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,

    CONSTRAINT "Investor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PropertyStake" (
    "investorId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "percent" DECIMAL(7,4) NOT NULL,

    CONSTRAINT "PropertyStake_pkey" PRIMARY KEY ("investorId","propertyId")
);

-- CreateTable
CREATE TABLE "FxRate" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "fromCcy" TEXT NOT NULL,
    "toCcy" TEXT NOT NULL,
    "rate" DECIMAL(20,8) NOT NULL,
    "asOf" TIMESTAMP(3) NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'manual',

    CONSTRAINT "FxRate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LedgerAccount" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "LedgerAccountType" NOT NULL,
    "isCash" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "LedgerAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalEntry" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryNo" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "memo" TEXT NOT NULL,
    "propertyId" TEXT,
    "currency" TEXT NOT NULL,
    "fxToBase" DECIMAL(20,8) NOT NULL DEFAULT 1,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "byUserId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalLine" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(18,2) NOT NULL DEFAULT 0,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RealProperty_tenantId_stage_idx" ON "RealProperty"("tenantId", "stage");

-- CreateIndex
CREATE UNIQUE INDEX "RealProperty_tenantId_name_key" ON "RealProperty"("tenantId", "name");

-- CreateIndex
CREATE INDEX "PropertyStageEvent_propertyId_at_idx" ON "PropertyStageEvent"("propertyId", "at");

-- CreateIndex
CREATE UNIQUE INDEX "Unit_propertyId_label_key" ON "Unit"("propertyId", "label");

-- CreateIndex
CREATE INDEX "Lease_unitId_idx" ON "Lease"("unitId");

-- CreateIndex
CREATE UNIQUE INDEX "Investor_tenantId_name_key" ON "Investor"("tenantId", "name");

-- CreateIndex
CREATE INDEX "FxRate_tenantId_fromCcy_toCcy_asOf_idx" ON "FxRate"("tenantId", "fromCcy", "toCcy", "asOf");

-- CreateIndex
CREATE UNIQUE INDEX "LedgerAccount_tenantId_code_key" ON "LedgerAccount"("tenantId", "code");

-- CreateIndex
CREATE INDEX "JournalEntry_tenantId_date_idx" ON "JournalEntry"("tenantId", "date");

-- CreateIndex
CREATE INDEX "JournalEntry_propertyId_date_idx" ON "JournalEntry"("propertyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_tenantId_entryNo_key" ON "JournalEntry"("tenantId", "entryNo");

-- CreateIndex
CREATE INDEX "JournalLine_entryId_idx" ON "JournalLine"("entryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "JournalLine"("accountId");

-- AddForeignKey
ALTER TABLE "RealProperty" ADD CONSTRAINT "RealProperty_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyStageEvent" ADD CONSTRAINT "PropertyStageEvent_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RealProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RealProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lease" ADD CONSTRAINT "Lease_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Investor" ADD CONSTRAINT "Investor_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyStake" ADD CONSTRAINT "PropertyStake_investorId_fkey" FOREIGN KEY ("investorId") REFERENCES "Investor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PropertyStake" ADD CONSTRAINT "PropertyStake_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RealProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FxRate" ADD CONSTRAINT "FxRate_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LedgerAccount" ADD CONSTRAINT "LedgerAccount_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalEntry" ADD CONSTRAINT "JournalEntry_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "RealProperty"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "LedgerAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

