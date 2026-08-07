-- Standardize application roles to ADMIN, DONOR, and HOSPITAL_ADMIN.
-- Existing accounts are preserved by mapping legacy operational roles before
-- the PostgreSQL enum is rebuilt.

-- Rebuild role permissions after the enum change so unsupported role grants
-- cannot remain attached to deleted enum values.
DELETE FROM "RolePermission";

CREATE TYPE "Role_new" AS ENUM ('ADMIN', 'DONOR', 'HOSPITAL_ADMIN');

ALTER TABLE "User"
  ALTER COLUMN "role" TYPE "Role_new"
  USING (
    CASE
      WHEN "role"::text IN ('SUPER_ADMIN', 'WEBSITE_CONTENT_ADMIN', 'AUDITOR') THEN 'ADMIN'
      WHEN "role"::text IN ('HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER', 'INVENTORY_OFFICER', 'DONOR_REVIEW_OFFICER') THEN 'HOSPITAL_ADMIN'
      WHEN "role"::text = 'DONOR' THEN 'DONOR'
      ELSE 'ADMIN'
    END::"Role_new"
  );

ALTER TABLE "RolePermission"
  ALTER COLUMN "role" TYPE "Role_new"
  USING ("role"::text::"Role_new");

DROP TYPE "Role";
ALTER TYPE "Role_new" RENAME TO "Role";

ALTER TYPE "PermissionCode" RENAME VALUE 'HOSPITAL_STAFF_MANAGE' TO 'HOSPITAL_ADMIN_MANAGE';
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'AI_INTELLIGENCE_VIEW';
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'AI_STOCK_RISK_VIEW';
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'AI_DONOR_RECOMMENDATION_VIEW';
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'AI_MOBILIZATION_PREVIEW';
ALTER TYPE "PermissionCode" ADD VALUE IF NOT EXISTS 'AI_RECOMMENDATION_HISTORY_VIEW';

CREATE TYPE "AiRecommendationType" AS ENUM ('STOCK_RISK', 'DONOR_MOBILIZATION', 'EXPIRY_RISK', 'DEMAND_TREND', 'CAMPAIGN_SUGGESTION');
CREATE TYPE "AiRiskLevel" AS ENUM ('LOW', 'MODERATE', 'HIGH', 'CRITICAL');
CREATE TYPE "AiConfidenceLevel" AS ENUM ('LOW', 'MEDIUM', 'HIGH');
CREATE TYPE "AiHandoffDestination" AS ENUM ('DONOR_COMMUNICATIONS', 'HOSPITAL_MOBILIZATION');

CREATE TABLE "AiRecommendation" (
  "id" TEXT NOT NULL,
  "generatedForUserId" TEXT,
  "generatedForRole" "Role" NOT NULL,
  "hospitalId" TEXT,
  "bloodGroup" "BloodGroup",
  "recommendationType" "AiRecommendationType" NOT NULL,
  "riskLevel" "AiRiskLevel",
  "confidenceLevel" "AiConfidenceLevel" NOT NULL DEFAULT 'LOW',
  "scoreSummaryJson" JSONB NOT NULL,
  "reasonsJson" JSONB NOT NULL,
  "suggestedAction" TEXT,
  "suggestedRecipientCount" INTEGER,
  "acceptedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "handoffDestination" "AiHandoffDestination",
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AiRecommendation_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AiRecommendation_generatedForUserId_createdAt_idx" ON "AiRecommendation"("generatedForUserId", "createdAt");
CREATE INDEX "AiRecommendation_hospitalId_createdAt_idx" ON "AiRecommendation"("hospitalId", "createdAt");
CREATE INDEX "AiRecommendation_recommendationType_idx" ON "AiRecommendation"("recommendationType");
CREATE INDEX "AiRecommendation_riskLevel_idx" ON "AiRecommendation"("riskLevel");

ALTER TABLE "AiRecommendation"
  ADD CONSTRAINT "AiRecommendation_generatedForUserId_fkey"
  FOREIGN KEY ("generatedForUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "AiRecommendation"
  ADD CONSTRAINT "AiRecommendation_hospitalId_fkey"
  FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;
