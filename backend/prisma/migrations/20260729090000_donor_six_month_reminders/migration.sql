ALTER TYPE "SmsPurpose" ADD VALUE IF NOT EXISTS 'DONOR_SIX_MONTH_REMINDER';

CREATE TABLE IF NOT EXISTS "DonorReminderLog" (
  "id" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "reminderType" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "status" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "providerCampaignId" TEXT,
  "smsLogId" TEXT,
  "failureReason" TEXT,
  "triggeredByUserId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "DonorReminderLog_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DonorReminderLog_donorId_fkey'
  ) THEN
    ALTER TABLE "DonorReminderLog"
      ADD CONSTRAINT "DonorReminderLog_donorId_fkey"
      FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'DonorReminderLog_triggeredByUserId_fkey'
  ) THEN
    ALTER TABLE "DonorReminderLog"
      ADD CONSTRAINT "DonorReminderLog_triggeredByUserId_fkey"
      FOREIGN KEY ("triggeredByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "DonorReminderLog_donorId_reminderType_dueDate_key"
  ON "DonorReminderLog"("donorId", "reminderType", "dueDate");
CREATE INDEX IF NOT EXISTS "DonorReminderLog_donorId_idx" ON "DonorReminderLog"("donorId");
CREATE INDEX IF NOT EXISTS "DonorReminderLog_reminderType_dueDate_status_idx"
  ON "DonorReminderLog"("reminderType", "dueDate", "status");
CREATE INDEX IF NOT EXISTS "DonorReminderLog_createdAt_idx" ON "DonorReminderLog"("createdAt");
