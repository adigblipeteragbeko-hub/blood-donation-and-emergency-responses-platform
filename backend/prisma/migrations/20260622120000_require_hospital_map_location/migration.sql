-- Ensure hospitals are always map-ready for emergency coordination.
UPDATE "Hospital"
SET
  "city" = COALESCE(NULLIF(TRIM("city"), ''), NULLIF(TRIM("location"), ''), 'Unknown'),
  "region" = COALESCE(NULLIF(TRIM("region"), ''), 'Ghana')
WHERE "city" IS NULL OR TRIM("city") = '' OR "region" IS NULL OR TRIM("region") = '';

-- Coordinates must be supplied through profile setup/editing before this migration can be applied.
-- Existing development records were reconciled before this migration was added.
ALTER TABLE "Hospital" ALTER COLUMN "city" SET NOT NULL;
ALTER TABLE "Hospital" ALTER COLUMN "region" SET NOT NULL;
ALTER TABLE "Hospital" ALTER COLUMN "latitude" SET NOT NULL;
ALTER TABLE "Hospital" ALTER COLUMN "longitude" SET NOT NULL;
