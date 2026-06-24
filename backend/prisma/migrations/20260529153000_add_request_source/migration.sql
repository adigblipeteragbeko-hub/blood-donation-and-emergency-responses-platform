DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'RequestSource') THEN
    CREATE TYPE "RequestSource" AS ENUM ('DONORS_ONLY', 'HOSPITALS_ONLY', 'DONORS_AND_HOSPITALS');
  END IF;
END $$;

ALTER TABLE "BloodRequest"
ADD COLUMN IF NOT EXISTS "requestSource" "RequestSource" NOT NULL DEFAULT 'DONORS_AND_HOSPITALS';

CREATE INDEX IF NOT EXISTS "BloodRequest_requestSource_idx" ON "BloodRequest"("requestSource");
