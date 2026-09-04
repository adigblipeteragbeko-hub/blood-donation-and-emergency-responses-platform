CREATE TYPE "EmergencyNotificationStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'RESOLVED', 'CANCELLED');

ALTER TABLE "BloodRequest"
ADD COLUMN "emergencyNotificationStatus" "EmergencyNotificationStatus",
ADD COLUMN "emergencyNotificationExpiresAt" TIMESTAMP(3),
ADD COLUMN "emergencyNotificationDurationMinutes" INTEGER,
ADD COLUMN "emergencyNotificationResolvedAt" TIMESTAMP(3),
ADD COLUMN "emergencyNotificationResolvedById" TEXT;

UPDATE "BloodRequest"
SET
  "emergencyNotificationDurationMinutes" = CASE WHEN "type" = 'EMERGENCY' THEN 120 ELSE NULL END,
  "emergencyNotificationExpiresAt" = CASE WHEN "type" = 'EMERGENCY' THEN "createdAt" + INTERVAL '120 minutes' ELSE NULL END,
  "emergencyNotificationStatus" = CASE
    WHEN "type" <> 'EMERGENCY' THEN NULL
    WHEN "status" = 'CANCELLED' THEN 'CANCELLED'::"EmergencyNotificationStatus"
    WHEN "status" = 'FULFILLED' OR "trackingStatus" = 'COMPLETED' THEN 'RESOLVED'::"EmergencyNotificationStatus"
    WHEN "createdAt" + INTERVAL '120 minutes' <= NOW() THEN 'EXPIRED'::"EmergencyNotificationStatus"
    ELSE 'ACTIVE'::"EmergencyNotificationStatus"
  END;

ALTER TABLE "BloodRequest"
ADD CONSTRAINT "BloodRequest_emergencyNotificationResolvedById_fkey"
FOREIGN KEY ("emergencyNotificationResolvedById")
REFERENCES "User"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

CREATE INDEX "BloodRequest_emergencyNotificationStatus_idx" ON "BloodRequest"("emergencyNotificationStatus");
CREATE INDEX "BloodRequest_emergencyNotificationExpiresAt_idx" ON "BloodRequest"("emergencyNotificationExpiresAt");
CREATE INDEX "BloodRequest_emergencyNotificationResolvedById_idx" ON "BloodRequest"("emergencyNotificationResolvedById");
