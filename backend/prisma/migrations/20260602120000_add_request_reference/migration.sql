ALTER TABLE "BloodRequest" ADD COLUMN "requestReference" TEXT;
ALTER TABLE "BloodRequest" ADD COLUMN "hospitalPatientReference" TEXT;

UPDATE "BloodRequest"
SET "hospitalPatientReference" = "patientCode"
WHERE "hospitalPatientReference" IS NULL
  AND "patientCode" IS NOT NULL;

WITH ranked_requests AS (
  SELECT
    id,
    EXTRACT(YEAR FROM COALESCE("createdAt", NOW()))::INT AS request_year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM COALESCE("createdAt", NOW()))::INT
      ORDER BY COALESCE("createdAt", NOW()), id
    ) AS sequence_number
  FROM "BloodRequest"
  WHERE "requestReference" IS NULL
)
UPDATE "BloodRequest" AS request
SET "requestReference" = CONCAT(
  'BDR-',
  ranked.request_year,
  '-',
  LPAD(ranked.sequence_number::TEXT, 5, '0')
)
FROM ranked_requests AS ranked
WHERE request.id = ranked.id;

ALTER TABLE "BloodRequest" ALTER COLUMN "requestReference" SET NOT NULL;

CREATE UNIQUE INDEX "BloodRequest_requestReference_key" ON "BloodRequest"("requestReference");
CREATE INDEX "BloodRequest_hospitalPatientReference_idx" ON "BloodRequest"("hospitalPatientReference");
