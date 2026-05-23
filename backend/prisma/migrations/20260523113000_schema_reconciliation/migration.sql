-- Reconcile schema drift for fields present in prisma/schema.prisma but missing in historical migrations.
-- Uses IF NOT EXISTS to stay safe on environments where some columns/indexes already exist.

ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "donorNumber" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "phone" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "dateOfBirth" TIMESTAMP(3);
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "postalAddress" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "signature" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "passportPhotoUrl" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "dateIssued" TIMESTAMP(3);

CREATE UNIQUE INDEX IF NOT EXISTS "Donor_donorNumber_key" ON "Donor"("donorNumber");
CREATE INDEX IF NOT EXISTS "Donor_donorNumber_idx" ON "Donor"("donorNumber");
CREATE INDEX IF NOT EXISTS "Donor_city_idx" ON "Donor"("city");
CREATE INDEX IF NOT EXISTS "Donor_region_idx" ON "Donor"("region");
CREATE INDEX IF NOT EXISTS "Donor_locationSharingEnabled_idx" ON "Donor"("locationSharingEnabled");
CREATE INDEX IF NOT EXISTS "Donor_latitude_longitude_idx" ON "Donor"("latitude", "longitude");
