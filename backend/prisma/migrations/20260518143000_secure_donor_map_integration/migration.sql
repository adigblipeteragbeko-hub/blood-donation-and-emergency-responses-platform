ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "areaCommunity" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "city" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "region" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "lastLocationUpdateAt" TIMESTAMP(3);
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "locationSharingEnabled" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "Donor_city_idx" ON "Donor"("city");
CREATE INDEX IF NOT EXISTS "Donor_region_idx" ON "Donor"("region");
CREATE INDEX IF NOT EXISTS "Donor_locationSharingEnabled_idx" ON "Donor"("locationSharingEnabled");
