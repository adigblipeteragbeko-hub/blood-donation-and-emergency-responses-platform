-- Add structured donor identity/contact fields without removing legacy fullName.
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "firstName" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "otherNames" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "surname" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "alternativePhoneNumber" TEXT;
ALTER TABLE "Donor" ADD COLUMN IF NOT EXISTS "emergencyContactRelationship" TEXT;

CREATE INDEX IF NOT EXISTS "Donor_surname_idx" ON "Donor"("surname");
