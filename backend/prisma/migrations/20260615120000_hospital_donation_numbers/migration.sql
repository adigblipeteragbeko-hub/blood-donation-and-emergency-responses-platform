-- Add hospital-specific code used for donation numbering.
ALTER TABLE "Hospital" ADD COLUMN IF NOT EXISTS "hospitalCode" TEXT;

WITH base_codes AS (
  SELECT
    h."id",
    COALESCE(
      NULLIF((
        SELECT string_agg(upper(left(word, 1)), '')
        FROM regexp_split_to_table(h."hospitalName", '\s+') AS word
        WHERE word !~* '^(and|of|the)$'
      ), ''),
      NULLIF(upper(regexp_replace(h."registrationCode", '[^A-Za-z0-9]', '', 'g')), ''),
      'HOSP'
    ) AS base_code
  FROM "Hospital" h
  WHERE h."hospitalCode" IS NULL
), numbered_codes AS (
  SELECT
    id,
    CASE
      WHEN row_number() OVER (PARTITION BY base_code ORDER BY id) = 1 THEN base_code
      ELSE base_code || row_number() OVER (PARTITION BY base_code ORDER BY id)::text
    END AS hospital_code
  FROM base_codes
)
UPDATE "Hospital" h
SET "hospitalCode" = numbered_codes.hospital_code
FROM numbered_codes
WHERE h."id" = numbered_codes.id
  AND h."hospitalCode" IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "Hospital_hospitalCode_key" ON "Hospital"("hospitalCode");

-- Donation records now own the operational donation number.
ALTER TABLE "Donation" ADD COLUMN IF NOT EXISTS "donationNumber" TEXT;

WITH ranked_donations AS (
  SELECT
    d."id",
    COALESCE(h."hospitalCode", 'HOSP') AS hospital_code,
    EXTRACT(YEAR FROM d."donatedAt")::int AS donation_year,
    row_number() OVER (
      PARTITION BY COALESCE(h."hospitalCode", 'HOSP'), EXTRACT(YEAR FROM d."donatedAt")::int
      ORDER BY d."donatedAt", d."createdAt", d."id"
    ) AS sequence_number
  FROM "Donation" d
  LEFT JOIN "Hospital" h ON h."id" = d."hospitalId"
  WHERE d."donationNumber" IS NULL
)
UPDATE "Donation" d
SET "donationNumber" = 'DON-' || ranked_donations.hospital_code || '-' || ranked_donations.donation_year || '-' || lpad(ranked_donations.sequence_number::text, 5, '0')
FROM ranked_donations
WHERE d."id" = ranked_donations."id";

CREATE UNIQUE INDEX IF NOT EXISTS "Donation_donationNumber_key" ON "Donation"("donationNumber");
CREATE INDEX IF NOT EXISTS "Donation_donationNumber_idx" ON "Donation"("donationNumber");
CREATE INDEX IF NOT EXISTS "Appointment_donationNumber_idx" ON "Appointment"("donationNumber");

UPDATE "Appointment" a
SET "donationNumber" = d."donationNumber"
FROM "Donation" d
WHERE a."donationId" = d."id"
  AND d."donationNumber" IS NOT NULL
  AND (a."donationNumber" IS NULL OR a."donationNumber" = '');
