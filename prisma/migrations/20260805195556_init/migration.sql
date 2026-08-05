-- CreateEnum
CREATE TYPE "Role" AS ENUM ('Encoder', 'Foreman', 'Bookkeeper', 'Owner');

-- CreateEnum
CREATE TYPE "AccountKind" AS ENUM ('Bank', 'Cash');

-- CreateEnum
CREATE TYPE "ListType" AS ENUM ('category', 'paymentMethod', 'supplier');

-- CreateTable
CREATE TABLE "Tenant" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tenant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TenantBranding" (
    "tenantId" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "ink" TEXT NOT NULL DEFAULT '#101634',
    "accent" TEXT NOT NULL DEFAULT '#2E4ABE',
    "accent2" TEXT NOT NULL DEFAULT '#32A9DC',
    "positive" TEXT NOT NULL DEFAULT '#0C6B59',
    "negative" TEXT NOT NULL DEFAULT '#C0242E',
    "paper" TEXT NOT NULL DEFAULT '#EEF1F7',
    "logoUrl" TEXT,

    CONSTRAINT "TenantBranding_pkey" PRIMARY KEY ("tenantId")
);

-- CreateTable
CREATE TABLE "TenantFeature" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "TenantFeature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProject" (
    "userId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,

    CONSTRAINT "UserProject_pkey" PRIMARY KEY ("userId","projectId")
);

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "no" TEXT,
    "name" TEXT NOT NULL,
    "client" TEXT,
    "contract" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'Ongoing',
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Account" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" "AccountKind" NOT NULL,
    "openingBalance" DECIMAL(14,2) NOT NULL DEFAULT 0,

    CONSTRAINT "Account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ListItem" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "type" "ListType" NOT NULL,
    "value" TEXT NOT NULL,

    CONSTRAINT "ListItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EntrySequence" (
    "tenantId" TEXT NOT NULL,
    "register" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "lastNumber" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "EntrySequence_pkey" PRIMARY KEY ("tenantId","register","year")
);

-- CreateTable
CREATE TABLE "Expense" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "particulars" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "supplier" TEXT,
    "invoice" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "paidFrom" TEXT NOT NULL,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "byUserId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payroll" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "payPeriod" TEXT NOT NULL,
    "payDate" TIMESTAMP(3) NOT NULL,
    "projectId" TEXT NOT NULL,
    "workers" TEXT,
    "regularPay" DECIMAL(14,2) NOT NULL,
    "otPay" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "caGiven" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "caDeduction" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paidBy" TEXT NOT NULL,
    "reference" TEXT,
    "remarks" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "byUserId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payroll_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Collection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "particulars" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "billAmount" DECIMAL(14,2) NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "chequeRef" TEXT,
    "ewt" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "depositedTo" TEXT NOT NULL,
    "remarks" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "byUserId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Collection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transfer" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "particulars" TEXT NOT NULL,
    "fromAccount" TEXT NOT NULL,
    "toAccount" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "voidedAt" TIMESTAMP(3),
    "voidReason" TEXT,
    "byUserId" TEXT NOT NULL,
    "byName" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "register" TEXT,
    "entryId" TEXT,
    "details" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Tenant_slug_key" ON "Tenant"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "TenantFeature_tenantId_key_key" ON "TenantFeature"("tenantId", "key");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_name_key" ON "User"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Project_tenantId_name_key" ON "Project"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Account_tenantId_name_key" ON "Account"("tenantId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "ListItem_tenantId_type_value_key" ON "ListItem"("tenantId", "type", "value");

-- CreateIndex
CREATE INDEX "Expense_tenantId_date_idx" ON "Expense"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Expense_tenantId_entryId_key" ON "Expense"("tenantId", "entryId");

-- CreateIndex
CREATE INDEX "Payroll_tenantId_payDate_idx" ON "Payroll"("tenantId", "payDate");

-- CreateIndex
CREATE UNIQUE INDEX "Payroll_tenantId_entryId_key" ON "Payroll"("tenantId", "entryId");

-- CreateIndex
CREATE INDEX "Collection_tenantId_date_idx" ON "Collection"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Collection_tenantId_entryId_key" ON "Collection"("tenantId", "entryId");

-- CreateIndex
CREATE INDEX "Transfer_tenantId_date_idx" ON "Transfer"("tenantId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "Transfer_tenantId_entryId_key" ON "Transfer"("tenantId", "entryId");

-- CreateIndex
CREATE INDEX "AuditLog_tenantId_at_idx" ON "AuditLog"("tenantId", "at");

-- AddForeignKey
ALTER TABLE "TenantBranding" ADD CONSTRAINT "TenantBranding_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TenantFeature" ADD CONSTRAINT "TenantFeature_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserProject" ADD CONSTRAINT "UserProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Project" ADD CONSTRAINT "Project_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Account" ADD CONSTRAINT "Account_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ListItem" ADD CONSTRAINT "ListItem_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EntrySequence" ADD CONSTRAINT "EntrySequence_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Expense" ADD CONSTRAINT "Expense_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payroll" ADD CONSTRAINT "Payroll_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Collection" ADD CONSTRAINT "Collection_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transfer" ADD CONSTRAINT "Transfer_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
