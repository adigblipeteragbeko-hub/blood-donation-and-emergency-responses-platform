-- AlterEnum
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'DONOR_CONTACT_VIEW';
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'DONOR_CONTACT_EXPORT';
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'SMS_CAMPAIGN_MANAGE';
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'SMS_CAMPAIGN_VIEW';

-- CreateEnum
CREATE TYPE "SmsCampaignStatus" AS ENUM ('DRAFT', 'PREVIEWED', 'PROCESSING', 'COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SmsCampaignRecipientStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

-- CreateEnum
CREATE TYPE "SmsSelectionMode" AS ENUM ('EXPLICIT', 'FILTERED');

-- CreateTable
CREATE TABLE "SmsCampaign" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "senderId" TEXT NOT NULL,
    "status" "SmsCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "createdById" TEXT,
    "selectionMode" "SmsSelectionMode" NOT NULL,
    "filtersJson" JSONB,
    "requestedDonorCount" INTEGER NOT NULL DEFAULT 0,
    "eligibleRecipientCount" INTEGER NOT NULL DEFAULT 0,
    "sentCount" INTEGER NOT NULL DEFAULT 0,
    "failedCount" INTEGER NOT NULL DEFAULT 0,
    "skippedCount" INTEGER NOT NULL DEFAULT 0,
    "creditUsed" INTEGER NOT NULL DEFAULT 0,
    "providerCampaignIdsJson" JSONB,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SmsCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "donorId" TEXT,
    "maskedPhone" TEXT,
    "status" "SmsCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "skipReason" TEXT,
    "smsLogId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SmsCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsCampaign_createdAt_idx" ON "SmsCampaign"("createdAt");

-- CreateIndex
CREATE INDEX "SmsCampaign_status_idx" ON "SmsCampaign"("status");

-- CreateIndex
CREATE INDEX "SmsCampaign_createdById_idx" ON "SmsCampaign"("createdById");

-- CreateIndex
CREATE INDEX "SmsCampaignRecipient_campaignId_idx" ON "SmsCampaignRecipient"("campaignId");

-- CreateIndex
CREATE INDEX "SmsCampaignRecipient_donorId_idx" ON "SmsCampaignRecipient"("donorId");

-- CreateIndex
CREATE INDEX "SmsCampaignRecipient_status_idx" ON "SmsCampaignRecipient"("status");

-- CreateIndex
CREATE INDEX "SmsCampaignRecipient_smsLogId_idx" ON "SmsCampaignRecipient"("smsLogId");

-- AddForeignKey
ALTER TABLE "SmsCampaign" ADD CONSTRAINT "SmsCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaignRecipient" ADD CONSTRAINT "SmsCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "SmsCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaignRecipient" ADD CONSTRAINT "SmsCampaignRecipient_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsCampaignRecipient" ADD CONSTRAINT "SmsCampaignRecipient_smsLogId_fkey" FOREIGN KEY ("smsLogId") REFERENCES "SmsLog"("id") ON DELETE SET NULL ON UPDATE CASCADE;
