-- Donation completion workflow: donor cooldown and inventory posting guard.
ALTER TABLE "Donor"
ADD COLUMN IF NOT EXISTS "lastDonationDate" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "nextEligibilityDate" TIMESTAMP(3);

ALTER TABLE "DonorClinicalDonationOutcome"
ADD COLUMN IF NOT EXISTS "unitsCollected" INTEGER,
ADD COLUMN IF NOT EXISTS "volumeCollectedMl" INTEGER,
ADD COLUMN IF NOT EXISTS "inventoryPostedAt" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "donationId" TEXT;

CREATE INDEX IF NOT EXISTS "Donor_nextEligibilityDate_idx" ON "Donor"("nextEligibilityDate");
CREATE INDEX IF NOT EXISTS "DonorClinicalDonationOutcome_inventoryPostedAt_idx" ON "DonorClinicalDonationOutcome"("inventoryPostedAt");
