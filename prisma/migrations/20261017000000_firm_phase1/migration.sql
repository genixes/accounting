-- CreateEnum
CREATE TYPE "TenantKind" AS ENUM ('CONSTRUCTION', 'SELLER');

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "OtpPurpose" AS ENUM ('CLIENT', 'STAFF');

-- CreateEnum
CREATE TYPE "StaffRole" AS ENUM ('ADMIN', 'PARTNER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "EmailStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "ConsultStatus" AS ENUM ('REQUESTED', 'SCHEDULED', 'DONE', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DeadlineStatus" AS ENUM ('OPEN', 'DONE');

-- AlterTable
ALTER TABLE "Tenant" ADD COLUMN     "kind" "TenantKind" NOT NULL DEFAULT 'CONSTRUCTION';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "email" TEXT;

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "businessName" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "consentVersion" TEXT NOT NULL,
    "quizVersion" TEXT NOT NULL,
    "answers" JSONB NOT NULL,
    "score" INTEGER NOT NULL,
    "planKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "planKey" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PHP',
    "status" "OrderStatus" NOT NULL DEFAULT 'PENDING',
    "referenceNumber" TEXT NOT NULL,
    "providerRef" TEXT,
    "checkoutUrl" TEXT,
    "expiresAt" TIMESTAMP(3),
    "paidAt" TIMESTAMP(3),
    "tenantId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymentEvent" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),
    "outcome" TEXT,

    CONSTRAINT "PaymentEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpChallenge" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "purpose" "OtpPurpose" NOT NULL,
    "codeHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "consumedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpChallenge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffUser" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "StaffRole" NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffAudit" (
    "id" TEXT NOT NULL,
    "staffId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "targetType" TEXT NOT NULL,
    "targetId" TEXT NOT NULL,
    "details" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StaffAudit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailOutbox" (
    "id" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "textBody" TEXT NOT NULL,
    "htmlBody" TEXT,
    "status" "EmailStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "dedupeKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),

    CONSTRAINT "EmailOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Consult" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "tenantId" TEXT,
    "status" "ConsultStatus" NOT NULL DEFAULT 'REQUESTED',
    "scheduledFor" TIMESTAMP(3),
    "meetUrl" TEXT,
    "notes" TEXT,
    "assignedToId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Consult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceDeadline" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "dueDate" DATE NOT NULL,
    "status" "DeadlineStatus" NOT NULL DEFAULT 'OPEN',
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceDeadline_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Lead_email_key" ON "Lead"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Order_referenceNumber_key" ON "Order"("referenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "Order_providerRef_key" ON "Order"("providerRef");

-- CreateIndex
CREATE UNIQUE INDEX "Order_tenantId_key" ON "Order"("tenantId");

-- CreateIndex
CREATE INDEX "Order_leadId_idx" ON "Order"("leadId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PaymentEvent_provider_providerEventId_key" ON "PaymentEvent"("provider", "providerEventId");

-- CreateIndex
CREATE INDEX "OtpChallenge_email_purpose_createdAt_idx" ON "OtpChallenge"("email", "purpose", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StaffUser_email_key" ON "StaffUser"("email");

-- CreateIndex
CREATE INDEX "StaffAudit_targetType_targetId_idx" ON "StaffAudit"("targetType", "targetId");

-- CreateIndex
CREATE INDEX "StaffAudit_at_idx" ON "StaffAudit"("at");

-- CreateIndex
CREATE UNIQUE INDEX "EmailOutbox_dedupeKey_key" ON "EmailOutbox"("dedupeKey");

-- CreateIndex
CREATE INDEX "EmailOutbox_status_createdAt_idx" ON "EmailOutbox"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Consult_status_scheduledFor_idx" ON "Consult"("status", "scheduledFor");

-- CreateIndex
CREATE INDEX "ComplianceDeadline_tenantId_dueDate_idx" ON "ComplianceDeadline"("tenantId", "dueDate");

-- CreateIndex
CREATE INDEX "User_email_idx" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_tenantId_email_key" ON "User"("tenantId", "email");

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffAudit" ADD CONSTRAINT "StaffAudit_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "StaffUser"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consult" ADD CONSTRAINT "Consult_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consult" ADD CONSTRAINT "Consult_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Consult" ADD CONSTRAINT "Consult_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "StaffUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ComplianceDeadline" ADD CONSTRAINT "ComplianceDeadline_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Invariants the application must never be able to violate.
ALTER TABLE "Order" ADD CONSTRAINT "Order_amount_positive" CHECK ("amount" > 0);
ALTER TABLE "OtpChallenge" ADD CONSTRAINT "OtpChallenge_attempts_nonneg" CHECK ("attempts" >= 0);
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "StaffUser" ADD CONSTRAINT "StaffUser_email_lowercase" CHECK ("email" = lower("email"));
ALTER TABLE "User" ADD CONSTRAINT "User_email_lowercase" CHECK ("email" IS NULL OR "email" = lower("email"));
