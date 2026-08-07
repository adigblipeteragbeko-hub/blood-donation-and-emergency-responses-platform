-- CreateEnum
CREATE TYPE "SmsStatus" AS ENUM ('PENDING', 'SENT', 'PARTIAL', 'FAILED', 'DELIVERED', 'REJECTED');

-- CreateEnum
CREATE TYPE "SmsPurpose" AS ENUM ('EMERGENCY_REQUEST', 'DONOR_MOBILIZATION', 'APPOINTMENT_CREATED', 'APPOINTMENT_REMINDER', 'APPOINTMENT_RESCHEDULED', 'APPOINTMENT_CANCELLED', 'ELIGIBILITY_APPROVED', 'ELIGIBILITY_REJECTED', 'DONATION_THANK_YOU', 'TEST');

-- AlterTable
ALTER TABLE "Donor" ADD COLUMN "phoneVerified" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "SmsLog" (
    "id" TEXT NOT NULL,
    "purpose" "SmsPurpose" NOT NULL,
    "status" "SmsStatus" NOT NULL DEFAULT 'PENDING',
    "recipientCount" INTEGER NOT NULL,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "rejectedCount" INTEGER NOT NULL DEFAULT 0,
    "senderId" TEXT NOT NULL,
    "messagePreview" TEXT NOT NULL,
    "providerCampaignId" TEXT,
    "providerCode" TEXT,
    "providerMessage" TEXT,
    "creditUsed" INTEGER,
    "creditLeft" INTEGER,
    "hospitalId" TEXT,
    "triggeredByUserId" TEXT,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "idempotencyKey" TEXT,
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SmsLog_idempotencyKey_key" ON "SmsLog"("idempotencyKey");

-- CreateIndex
CREATE INDEX "SmsLog_createdAt_idx" ON "SmsLog"("createdAt");

-- CreateIndex
CREATE INDEX "SmsLog_purpose_idx" ON "SmsLog"("purpose");

-- CreateIndex
CREATE INDEX "SmsLog_status_idx" ON "SmsLog"("status");

-- CreateIndex
CREATE INDEX "SmsLog_hospitalId_idx" ON "SmsLog"("hospitalId");

-- CreateIndex
CREATE INDEX "SmsLog_triggeredByUserId_idx" ON "SmsLog"("triggeredByUserId");

-- CreateIndex
CREATE INDEX "SmsLog_relatedEntityType_relatedEntityId_idx" ON "SmsLog"("relatedEntityType", "relatedEntityId");

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsLog" ADD CONSTRAINT "SmsLog_triggeredByUserId_fkey" FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
