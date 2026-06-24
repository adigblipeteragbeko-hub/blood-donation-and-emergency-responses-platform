-- Appointment-driven donation posting and duplicate protection.
ALTER TABLE "Appointment"
ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "unitsCollected" INTEGER,
ADD COLUMN IF NOT EXISTS "volumeCollectedMl" INTEGER,
ADD COLUMN IF NOT EXISTS "donationNumber" TEXT,
ADD COLUMN IF NOT EXISTS "donationNotes" TEXT,
ADD COLUMN IF NOT EXISTS "donationPostedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "donationId" TEXT;

CREATE INDEX IF NOT EXISTS "Appointment_donationPostedAt_idx" ON "Appointment"("donationPostedAt");
