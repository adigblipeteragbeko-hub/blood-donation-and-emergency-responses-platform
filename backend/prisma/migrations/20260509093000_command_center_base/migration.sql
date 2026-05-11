-- Hospital command-center base tables used by admin analytics, reviews,
-- operations feed, audit filtering, and security monitoring.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DonorReviewStatus') THEN
    CREATE TYPE "DonorReviewStatus" AS ENUM (
      'SUBMITTED',
      'HOSPITAL_REVIEW',
      'OFFICE_USE_COMPLETED',
      'APPROVED',
      'REJECTED'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'SecurityEventSeverity') THEN
    CREATE TYPE "SecurityEventSeverity" AS ENUM ('INFO', 'WARNING', 'CRITICAL');
  END IF;
END $$;

ALTER TABLE "AuditLog"
  ADD COLUMN IF NOT EXISTS "module" TEXT,
  ADD COLUMN IF NOT EXISTS "oldValue" JSONB,
  ADD COLUMN IF NOT EXISTS "newValue" JSONB;

ALTER TABLE "InventoryItem"
  ADD COLUMN IF NOT EXISTS "criticalThreshold" INTEGER NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS "expiringUnits" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "lowThreshold" INTEGER NOT NULL DEFAULT 7;

CREATE TABLE IF NOT EXISTS "DonorEligibilityReview" (
  "id" TEXT NOT NULL,
  "donorId" TEXT NOT NULL,
  "selectedHospitalId" TEXT,
  "status" "DonorReviewStatus" NOT NULL DEFAULT 'SUBMITTED',
  "reviewNotes" TEXT,
  "officeUseNotes" TEXT,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "hospitalReviewedAt" TIMESTAMP(3),
  "officeCompletedAt" TIMESTAMP(3),
  "approvedAt" TIMESTAMP(3),
  "rejectedAt" TIMESTAMP(3),
  "reviewerId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DonorEligibilityReview_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "ActivityLog" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "actorName" TEXT,
  "type" TEXT NOT NULL,
  "module" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "entityType" TEXT,
  "entityId" TEXT,
  "donorId" TEXT,
  "hospitalId" TEXT,
  "bloodRequestId" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SecurityEvent" (
  "id" TEXT NOT NULL,
  "actorUserId" TEXT,
  "email" TEXT,
  "eventType" TEXT NOT NULL,
  "severity" "SecurityEventSeverity" NOT NULL DEFAULT 'INFO',
  "description" TEXT NOT NULL,
  "ipAddress" TEXT,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SecurityEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AuditLog_module_idx" ON "AuditLog"("module");
CREATE INDEX IF NOT EXISTS "AuditLog_actorUserId_idx" ON "AuditLog"("actorUserId");

CREATE INDEX IF NOT EXISTS "DonorEligibilityReview_donorId_idx" ON "DonorEligibilityReview"("donorId");
CREATE INDEX IF NOT EXISTS "DonorEligibilityReview_selectedHospitalId_idx" ON "DonorEligibilityReview"("selectedHospitalId");
CREATE INDEX IF NOT EXISTS "DonorEligibilityReview_status_idx" ON "DonorEligibilityReview"("status");
CREATE INDEX IF NOT EXISTS "DonorEligibilityReview_createdAt_idx" ON "DonorEligibilityReview"("createdAt");

CREATE INDEX IF NOT EXISTS "ActivityLog_actorUserId_idx" ON "ActivityLog"("actorUserId");
CREATE INDEX IF NOT EXISTS "ActivityLog_donorId_idx" ON "ActivityLog"("donorId");
CREATE INDEX IF NOT EXISTS "ActivityLog_hospitalId_idx" ON "ActivityLog"("hospitalId");
CREATE INDEX IF NOT EXISTS "ActivityLog_bloodRequestId_idx" ON "ActivityLog"("bloodRequestId");
CREATE INDEX IF NOT EXISTS "ActivityLog_module_idx" ON "ActivityLog"("module");
CREATE INDEX IF NOT EXISTS "ActivityLog_type_idx" ON "ActivityLog"("type");
CREATE INDEX IF NOT EXISTS "ActivityLog_createdAt_idx" ON "ActivityLog"("createdAt");

CREATE INDEX IF NOT EXISTS "SecurityEvent_actorUserId_idx" ON "SecurityEvent"("actorUserId");
CREATE INDEX IF NOT EXISTS "SecurityEvent_eventType_idx" ON "SecurityEvent"("eventType");
CREATE INDEX IF NOT EXISTS "SecurityEvent_severity_idx" ON "SecurityEvent"("severity");
CREATE INDEX IF NOT EXISTS "SecurityEvent_createdAt_idx" ON "SecurityEvent"("createdAt");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DonorEligibilityReview_donorId_fkey') THEN
    ALTER TABLE "DonorEligibilityReview" ADD CONSTRAINT "DonorEligibilityReview_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DonorEligibilityReview_selectedHospitalId_fkey') THEN
    ALTER TABLE "DonorEligibilityReview" ADD CONSTRAINT "DonorEligibilityReview_selectedHospitalId_fkey" FOREIGN KEY ("selectedHospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DonorEligibilityReview_reviewerId_fkey') THEN
    ALTER TABLE "DonorEligibilityReview" ADD CONSTRAINT "DonorEligibilityReview_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'ActivityLog_actorUserId_fkey') THEN
    ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SecurityEvent_actorUserId_fkey') THEN
    ALTER TABLE "SecurityEvent" ADD CONSTRAINT "SecurityEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
