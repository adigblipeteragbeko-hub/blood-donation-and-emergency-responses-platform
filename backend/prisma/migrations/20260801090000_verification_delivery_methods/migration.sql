CREATE TYPE "VerificationDeliveryMethod" AS ENUM ('EMAIL', 'SMS');

ALTER TYPE "SmsPurpose" ADD VALUE IF NOT EXISTS 'ACCOUNT_VERIFICATION';

ALTER TABLE "EmailVerificationToken"
  ADD COLUMN IF NOT EXISTS "deliveryMethod" "VerificationDeliveryMethod" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE "EmailVerificationAttempt"
  ADD COLUMN IF NOT EXISTS "deliveryMethod" "VerificationDeliveryMethod" NOT NULL DEFAULT 'EMAIL',
  ADD COLUMN IF NOT EXISTS "maskedDestination" TEXT;
