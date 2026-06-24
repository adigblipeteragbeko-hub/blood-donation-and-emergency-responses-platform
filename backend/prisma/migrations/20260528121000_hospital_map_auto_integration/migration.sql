-- AlterTable
ALTER TABLE "Donor"
ADD COLUMN "preferredHospitalId" TEXT;

-- AlterTable
ALTER TABLE "Hospital"
ADD COLUMN "bloodBankAvailable" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "city" TEXT,
ADD COLUMN "region" TEXT;

-- CreateIndex
CREATE INDEX "Donor_preferredHospitalId_idx" ON "Donor"("preferredHospitalId");

-- CreateIndex
CREATE INDEX "Hospital_city_idx" ON "Hospital"("city");

-- CreateIndex
CREATE INDEX "Hospital_region_idx" ON "Hospital"("region");

-- CreateIndex
CREATE INDEX "Hospital_bloodBankAvailable_idx" ON "Hospital"("bloodBankAvailable");

-- AddForeignKey
ALTER TABLE "Donor"
ADD CONSTRAINT "Donor_preferredHospitalId_fkey"
FOREIGN KEY ("preferredHospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
