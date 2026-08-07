-- Supervisor feedback pass: verification delivery tracking, manual verification metadata, donor image support, and stock warning records.

CREATE TYPE "EmailVerificationPurpose" AS ENUM ('ACCOUNT_VERIFICATION');
CREATE TYPE "EmailVerificationDeliveryStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'VERIFIED', 'EXPIRED', 'CANCELLED');
CREATE TYPE "ManualVerificationMethod" AS ENUM ('USER_CONFIRMED_IN_PERSON', 'VERIFIED_BY_PHONE', 'VERIFIED_AT_HOSPITAL', 'EMAIL_PROVIDER_FAILURE', 'OTHER');
CREATE TYPE "StockWarningLevel" AS ENUM ('STABLE', 'WATCH', 'LIKELY_SHORTAGE', 'CRITICAL');
CREATE TYPE "MobilizationCampaignStatus" AS ENUM ('DRAFT', 'SENT', 'CANCELLED');

ALTER TABLE "User"
ADD COLUMN "verifiedAt" TIMESTAMP(3),
ADD COLUMN "verifiedByAdminId" TEXT,
ADD COLUMN "verificationMethod" "ManualVerificationMethod",
ADD COLUMN "verificationReason" TEXT,
ADD COLUMN "verificationNote" TEXT;

ALTER TABLE "Donor"
ADD COLUMN "profileImageUrl" TEXT,
ADD COLUMN "profileImageUpdatedAt" TIMESTAMP(3);

CREATE TABLE "EmailVerificationAttempt" (
  "id" TEXT NOT NULL,
  "userId" TEXT,
  "email" TEXT NOT NULL,
  "purpose" "EmailVerificationPurpose" NOT NULL DEFAULT 'ACCOUNT_VERIFICATION',
  "provider" TEXT,
  "status" "EmailVerificationDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "failureReason" TEXT,
  "providerMessageId" TEXT,
  "requestedByUserId" TEXT,
  "createdByAdminId" TEXT,
  "ipAddress" TEXT,
  "userAgent" TEXT,
  "expiresAt" TIMESTAMP(3),
  "sentAt" TIMESTAMP(3),
  "failedAt" TIMESTAMP(3),
  "verifiedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EmailVerificationAttempt_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BloodStockWarning" (
  "id" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "bloodGroup" "BloodGroup" NOT NULL,
  "level" "StockWarningLevel" NOT NULL,
  "currentUnits" INTEGER NOT NULL,
  "estimatedDaysOfCover" DOUBLE PRECISION,
  "expiringUnits" INTEGER NOT NULL DEFAULT 0,
  "activeDemandUnits" INTEGER NOT NULL DEFAULT 0,
  "incomingTransferUnits" INTEGER NOT NULL DEFAULT 0,
  "scheduledDonationUnits" INTEGER NOT NULL DEFAULT 0,
  "explanation" TEXT NOT NULL,
  "recommendedAction" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "BloodStockWarning_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DonorMobilizationCampaign" (
  "id" TEXT NOT NULL,
  "hospitalId" TEXT NOT NULL,
  "bloodGroup" "BloodGroup" NOT NULL,
  "warningLevel" "StockWarningLevel" NOT NULL,
  "status" "MobilizationCampaignStatus" NOT NULL DEFAULT 'DRAFT',
  "message" TEXT NOT NULL,
  "targetDonorCount" INTEGER NOT NULL DEFAULT 0,
  "sentAt" TIMESTAMP(3),
  "createdById" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DonorMobilizationCampaign_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "User_emailVerified_idx" ON "User"("emailVerified");
CREATE INDEX "User_verifiedByAdminId_idx" ON "User"("verifiedByAdminId");
CREATE INDEX "EmailVerificationAttempt_userId_createdAt_idx" ON "EmailVerificationAttempt"("userId", "createdAt");
CREATE INDEX "EmailVerificationAttempt_email_idx" ON "EmailVerificationAttempt"("email");
CREATE INDEX "EmailVerificationAttempt_status_idx" ON "EmailVerificationAttempt"("status");
CREATE INDEX "EmailVerificationAttempt_createdAt_idx" ON "EmailVerificationAttempt"("createdAt");
CREATE INDEX "BloodStockWarning_hospitalId_bloodGroup_createdAt_idx" ON "BloodStockWarning"("hospitalId", "bloodGroup", "createdAt");
CREATE INDEX "BloodStockWarning_level_idx" ON "BloodStockWarning"("level");
CREATE INDEX "BloodStockWarning_createdAt_idx" ON "BloodStockWarning"("createdAt");
CREATE INDEX "DonorMobilizationCampaign_hospitalId_createdAt_idx" ON "DonorMobilizationCampaign"("hospitalId", "createdAt");
CREATE INDEX "DonorMobilizationCampaign_bloodGroup_idx" ON "DonorMobilizationCampaign"("bloodGroup");
CREATE INDEX "DonorMobilizationCampaign_status_idx" ON "DonorMobilizationCampaign"("status");

ALTER TABLE "User"
ADD CONSTRAINT "User_verifiedByAdminId_fkey" FOREIGN KEY ("verifiedByAdminId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EmailVerificationAttempt"
ADD CONSTRAINT "EmailVerificationAttempt_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "BloodStockWarning"
ADD CONSTRAINT "BloodStockWarning_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DonorMobilizationCampaign"
ADD CONSTRAINT "DonorMobilizationCampaign_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DonorMobilizationCampaign"
ADD CONSTRAINT "DonorMobilizationCampaign_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
