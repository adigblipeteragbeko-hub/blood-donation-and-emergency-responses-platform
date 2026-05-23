ALTER TABLE "BloodRequest" ADD COLUMN IF NOT EXISTS "hospitalCenterName" TEXT;
ALTER TABLE "BloodRequest" ADD COLUMN IF NOT EXISTS "ward" TEXT;
ALTER TABLE "BloodRequest" ADD COLUMN IF NOT EXISTS "emergencyLocation" TEXT;
ALTER TABLE "BloodRequest" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "BloodRequest" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "BloodRequest" ADD COLUMN IF NOT EXISTS "locationNotes" TEXT;

CREATE INDEX IF NOT EXISTS "BloodRequest_city_idx" ON "BloodRequest"("city");
CREATE INDEX IF NOT EXISTS "BloodRequest_region_idx" ON "BloodRequest"("region");
