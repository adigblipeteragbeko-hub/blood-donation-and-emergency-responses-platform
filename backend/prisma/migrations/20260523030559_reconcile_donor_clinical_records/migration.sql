-- CreateEnum
CREATE TYPE "DonorClinicalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'HOSPITAL_REVIEW', 'OFFICE_USE_COMPLETED', 'APPROVED', 'REJECTED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED');

-- CreateEnum
CREATE TYPE "ClinicalPassFail" AS ENUM ('PASSED', 'FAILED');

-- CreateEnum
CREATE TYPE "ClinicalYesNo" AS ENUM ('YES', 'NO');

-- CreateEnum
CREATE TYPE "ClinicalScreeningOutcome" AS ENUM ('QUALIFIED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PackType" AS ENUM ('SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD');

-- CreateEnum
CREATE TYPE "PhlebotomyOutcome" AS ENUM ('SUCCESSFUL', 'UNSUCCESSFUL');

-- CreateTable
CREATE TABLE "DonorClinicalRecord" (
    "id" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "selectedHospitalId" TEXT,
    "reviewerId" TEXT,
    "status" "DonorClinicalStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isLocked" BOOLEAN NOT NULL DEFAULT false,
    "submittedAt" TIMESTAMP(3),
    "hospitalReviewedAt" TIMESTAMP(3),
    "officeCompletedAt" TIMESTAMP(3),
    "finalDecisionAt" TIMESTAMP(3),
    "formDate" TIMESTAMP(3),
    "venue" TEXT,
    "title" TEXT,
    "firstName" TEXT,
    "lastName" TEXT,
    "callingName" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "sex" TEXT,
    "areaOfResidence" TEXT,
    "addressOrWorkplace" TEXT,
    "occupation" TEXT,
    "idType" TEXT,
    "idNumber" TEXT,
    "phoneNumber" TEXT,
    "email" TEXT,
    "preferredContactMethod" TEXT,
    "doNotContactForDonation" BOOLEAN NOT NULL DEFAULT false,
    "donorType" TEXT DEFAULT 'VOLUNTARY',
    "hasDonatedBefore" BOOLEAN,
    "lastDonationDate" TIMESTAMP(3),
    "numberOfVoluntaryDonations" INTEGER NOT NULL DEFAULT 0,
    "numberOfReplacementDonations" INTEGER NOT NULL DEFAULT 0,
    "donorCardNumber" TEXT,
    "patientName" TEXT,
    "patientHospital" TEXT,
    "ward" TEXT,
    "relationshipToPatient" TEXT,
    "clerkingOfficerName" TEXT,
    "clerkingOfficerSignature" TEXT,
    "declarationConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "testingConsent" BOOLEAN NOT NULL DEFAULT false,
    "contactConsent" BOOLEAN NOT NULL DEFAULT false,
    "staffEligibilityConsent" BOOLEAN NOT NULL DEFAULT false,
    "dataUseConsent" BOOLEAN NOT NULL DEFAULT false,
    "donorSignature" TEXT,
    "declarationDate" TIMESTAMP(3),
    "counsellorName" TEXT,
    "counsellorSignature" TEXT,
    "donorRiskFlag" BOOLEAN NOT NULL DEFAULT false,
    "donorRiskSummary" TEXT,
    "reviewNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorClinicalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorClinicalHealthAnswer" (
    "id" TEXT NOT NULL,
    "clinicalRecordId" TEXT NOT NULL,
    "questionKey" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answer" BOOLEAN NOT NULL,
    "details" TEXT,
    "riskFlag" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorClinicalHealthAnswer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorClinicalReview" (
    "id" TEXT NOT NULL,
    "clinicalRecordId" TEXT NOT NULL,
    "appearancePassed" "ClinicalPassFail",
    "medicalHistoryPassed" "ClinicalPassFail",
    "weightKg" DOUBLE PRECISION,
    "bloodPressure" TEXT,
    "pulseBpm" INTEGER,
    "haemoglobinLevel" DOUBLE PRECISION,
    "hbByCuSO4Passed" "ClinicalPassFail",
    "hbSagChecked" "ClinicalYesNo",
    "hbSagResult" TEXT,
    "qualifiesToDonate" "ClinicalYesNo",
    "outcomeOfScreening" "ClinicalScreeningOutcome",
    "permanentDeferralReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "temporaryDeferralReasons" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "temporaryDeferralDuration" TEXT,
    "comments" TEXT,
    "nurseName" TEXT,
    "nurseSignature" TEXT,
    "reviewedById" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorClinicalReview_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorClinicalDonationOutcome" (
    "id" TEXT NOT NULL,
    "clinicalRecordId" TEXT NOT NULL,
    "donationNumber" TEXT,
    "packType" "PackType",
    "bleedStartTime" TIMESTAMP(3),
    "bleedEndTime" TIMESTAMP(3),
    "dryPack" BOOLEAN NOT NULL DEFAULT false,
    "apheresis" BOOLEAN NOT NULL DEFAULT false,
    "testOnly" BOOLEAN NOT NULL DEFAULT false,
    "didNotBleed" BOOLEAN NOT NULL DEFAULT false,
    "outcomeOfPhlebotomy" "PhlebotomyOutcome",
    "unsuccessfulReason" TEXT,
    "venousAccessIssue" BOOLEAN NOT NULL DEFAULT false,
    "underbledMl" INTEGER,
    "donorReaction" BOOLEAN NOT NULL DEFAULT false,
    "adverseEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "nurseName" TEXT,
    "nurseSignature" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DonorClinicalDonationOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorClinicalFormVersion" (
    "id" TEXT NOT NULL,
    "clinicalRecordId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "changeReason" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonorClinicalFormVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorClinicalAuditTrail" (
    "id" TEXT NOT NULL,
    "clinicalRecordId" TEXT NOT NULL,
    "actorUserId" TEXT,
    "action" TEXT NOT NULL,
    "description" TEXT,
    "oldValue" JSONB,
    "newValue" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DonorClinicalAuditTrail_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DonorClinicalRecord_donorId_idx" ON "DonorClinicalRecord"("donorId");

-- CreateIndex
CREATE INDEX "DonorClinicalRecord_selectedHospitalId_idx" ON "DonorClinicalRecord"("selectedHospitalId");

-- CreateIndex
CREATE INDEX "DonorClinicalRecord_status_idx" ON "DonorClinicalRecord"("status");

-- CreateIndex
CREATE INDEX "DonorClinicalRecord_createdAt_idx" ON "DonorClinicalRecord"("createdAt");

-- CreateIndex
CREATE INDEX "DonorClinicalRecord_hospitalReviewedAt_idx" ON "DonorClinicalRecord"("hospitalReviewedAt");

-- CreateIndex
CREATE INDEX "DonorClinicalHealthAnswer_clinicalRecordId_idx" ON "DonorClinicalHealthAnswer"("clinicalRecordId");

-- CreateIndex
CREATE INDEX "DonorClinicalHealthAnswer_riskFlag_idx" ON "DonorClinicalHealthAnswer"("riskFlag");

-- CreateIndex
CREATE UNIQUE INDEX "DonorClinicalHealthAnswer_clinicalRecordId_questionKey_key" ON "DonorClinicalHealthAnswer"("clinicalRecordId", "questionKey");

-- CreateIndex
CREATE UNIQUE INDEX "DonorClinicalReview_clinicalRecordId_key" ON "DonorClinicalReview"("clinicalRecordId");

-- CreateIndex
CREATE INDEX "DonorClinicalReview_reviewedAt_idx" ON "DonorClinicalReview"("reviewedAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonorClinicalDonationOutcome_clinicalRecordId_key" ON "DonorClinicalDonationOutcome"("clinicalRecordId");

-- CreateIndex
CREATE INDEX "DonorClinicalFormVersion_clinicalRecordId_version_idx" ON "DonorClinicalFormVersion"("clinicalRecordId", "version");

-- CreateIndex
CREATE INDEX "DonorClinicalFormVersion_createdAt_idx" ON "DonorClinicalFormVersion"("createdAt");

-- CreateIndex
CREATE INDEX "DonorClinicalAuditTrail_clinicalRecordId_createdAt_idx" ON "DonorClinicalAuditTrail"("clinicalRecordId", "createdAt");

-- CreateIndex
CREATE INDEX "DonorClinicalAuditTrail_actorUserId_idx" ON "DonorClinicalAuditTrail"("actorUserId");

-- CreateIndex
CREATE INDEX "DonorClinicalAuditTrail_action_idx" ON "DonorClinicalAuditTrail"("action");

-- CreateIndex
CREATE INDEX "Appointment_donorId_idx" ON "Appointment"("donorId");

-- CreateIndex
CREATE INDEX "Appointment_hospitalId_idx" ON "Appointment"("hospitalId");

-- CreateIndex
CREATE INDEX "BloodRequest_hospitalId_idx" ON "BloodRequest"("hospitalId");

-- CreateIndex
CREATE INDEX "BloodRequest_priority_idx" ON "BloodRequest"("priority");

-- CreateIndex
CREATE INDEX "Donation_donorId_idx" ON "Donation"("donorId");

-- CreateIndex
CREATE INDEX "Donation_hospitalId_idx" ON "Donation"("hospitalId");

-- CreateIndex
CREATE INDEX "DonorResponse_bloodRequestId_idx" ON "DonorResponse"("bloodRequestId");

-- CreateIndex
CREATE INDEX "DonorResponse_donorId_idx" ON "DonorResponse"("donorId");

-- CreateIndex
CREATE INDEX "InventoryItem_hospitalId_idx" ON "InventoryItem"("hospitalId");

-- CreateIndex
CREATE INDEX "Notification_userId_idx" ON "Notification"("userId");

-- AddForeignKey
ALTER TABLE "DonorClinicalRecord" ADD CONSTRAINT "DonorClinicalRecord_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorClinicalRecord" ADD CONSTRAINT "DonorClinicalRecord_selectedHospitalId_fkey" FOREIGN KEY ("selectedHospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorClinicalRecord" ADD CONSTRAINT "DonorClinicalRecord_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorClinicalHealthAnswer" ADD CONSTRAINT "DonorClinicalHealthAnswer_clinicalRecordId_fkey" FOREIGN KEY ("clinicalRecordId") REFERENCES "DonorClinicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorClinicalReview" ADD CONSTRAINT "DonorClinicalReview_clinicalRecordId_fkey" FOREIGN KEY ("clinicalRecordId") REFERENCES "DonorClinicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorClinicalDonationOutcome" ADD CONSTRAINT "DonorClinicalDonationOutcome_clinicalRecordId_fkey" FOREIGN KEY ("clinicalRecordId") REFERENCES "DonorClinicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorClinicalFormVersion" ADD CONSTRAINT "DonorClinicalFormVersion_clinicalRecordId_fkey" FOREIGN KEY ("clinicalRecordId") REFERENCES "DonorClinicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorClinicalAuditTrail" ADD CONSTRAINT "DonorClinicalAuditTrail_clinicalRecordId_fkey" FOREIGN KEY ("clinicalRecordId") REFERENCES "DonorClinicalRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorClinicalAuditTrail" ADD CONSTRAINT "DonorClinicalAuditTrail_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
