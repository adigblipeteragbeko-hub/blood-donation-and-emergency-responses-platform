-- Add live map tracking coordinates for emergency blood requests.
ALTER TABLE "BloodRequest" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "BloodRequest" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

CREATE INDEX IF NOT EXISTS "Donor_latitude_longitude_idx" ON "Donor"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "Hospital_latitude_longitude_idx" ON "Hospital"("latitude", "longitude");
CREATE INDEX IF NOT EXISTS "BloodRequest_latitude_longitude_idx" ON "BloodRequest"("latitude", "longitude");
