CREATE TYPE "DonorProfileVisibility" AS ENUM ('PRIVATE', 'PUBLIC');

ALTER TABLE "Donor"
ADD COLUMN "profileVisibility" "DonorProfileVisibility" NOT NULL DEFAULT 'PRIVATE';

CREATE INDEX "Donor_profileVisibility_idx" ON "Donor"("profileVisibility");
