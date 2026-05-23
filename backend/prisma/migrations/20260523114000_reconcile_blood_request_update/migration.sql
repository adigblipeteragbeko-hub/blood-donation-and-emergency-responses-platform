ALTER TABLE "BloodRequestUpdate" ADD COLUMN IF NOT EXISTS "transfusedByStaffId" TEXT;
ALTER TABLE "BloodRequestUpdate" ADD COLUMN IF NOT EXISTS "unitDin" TEXT;
ALTER TABLE "BloodRequestUpdate" ADD COLUMN IF NOT EXISTS "patientEncounterId" TEXT;
ALTER TABLE "BloodRequestUpdate" ADD COLUMN IF NOT EXISTS "overrideReason" TEXT;
