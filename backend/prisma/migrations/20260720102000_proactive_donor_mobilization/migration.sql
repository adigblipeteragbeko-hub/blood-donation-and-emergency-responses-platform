-- Dedicated proactive donor mobilization tracking.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'PROACTIVE_DONATION' AND enumtypid = '"NotificationType"'::regtype) THEN
    ALTER TYPE "NotificationType" ADD VALUE 'PROACTIVE_DONATION';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MobilizationResponseStatus') THEN
    CREATE TYPE "MobilizationResponseStatus" AS ENUM ('INTERESTED', 'NOT_AVAILABLE', 'APPOINTMENT_SCHEDULED');
  END IF;
END $$;

ALTER TABLE "Notification" ADD COLUMN IF NOT EXISTS "campaignId" TEXT;
ALTER TABLE "DonorMobilizationCampaign" ADD COLUMN IF NOT EXISTS "forecastPeriodHours" INTEGER NOT NULL DEFAULT 48;
ALTER TABLE "DonorMobilizationCampaign" ADD COLUMN IF NOT EXISTS "radiusKm" INTEGER NOT NULL DEFAULT 25;
ALTER TABLE "DonorMobilizationCampaign" ADD COLUMN IF NOT EXISTS "warningReason" TEXT;

CREATE TABLE IF NOT EXISTS "DonorMobilizationCampaignResponse" (
  "id" TEXT NOT NULL,
  "campaignId" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "userId" TEXT,
  "responseStatus" "MobilizationResponseStatus" NOT NULL,
  "notes" TEXT,
  "respondedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DonorMobilizationCampaignResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "DonorMobilizationCampaignResponse_campaignId_donorId_key" ON "DonorMobilizationCampaignResponse"("campaignId", "donorId");
CREATE INDEX IF NOT EXISTS "DonorMobilizationCampaignResponse_campaignId_idx" ON "DonorMobilizationCampaignResponse"("campaignId");
CREATE INDEX IF NOT EXISTS "DonorMobilizationCampaignResponse_donorId_idx" ON "DonorMobilizationCampaignResponse"("donorId");
CREATE INDEX IF NOT EXISTS "DonorMobilizationCampaignResponse_responseStatus_idx" ON "DonorMobilizationCampaignResponse"("responseStatus");
CREATE INDEX IF NOT EXISTS "DonorMobilizationCampaignResponse_respondedAt_idx" ON "DonorMobilizationCampaignResponse"("respondedAt");
CREATE INDEX IF NOT EXISTS "Notification_campaignId_idx" ON "Notification"("campaignId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Notification_campaignId_fkey') THEN
    ALTER TABLE "Notification" ADD CONSTRAINT "Notification_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DonorMobilizationCampaign"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DonorMobilizationCampaignResponse_campaignId_fkey') THEN
    ALTER TABLE "DonorMobilizationCampaignResponse" ADD CONSTRAINT "DonorMobilizationCampaignResponse_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "DonorMobilizationCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DonorMobilizationCampaignResponse_donorId_fkey') THEN
    ALTER TABLE "DonorMobilizationCampaignResponse" ADD CONSTRAINT "DonorMobilizationCampaignResponse_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DonorMobilizationCampaignResponse_userId_fkey') THEN
    ALTER TABLE "DonorMobilizationCampaignResponse" ADD CONSTRAINT "DonorMobilizationCampaignResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
