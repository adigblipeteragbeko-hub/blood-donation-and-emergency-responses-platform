-- Remove obsolete donor clinical calling name field and standardize donor references.
ALTER TABLE "DonorClinicalRecord" DROP COLUMN IF EXISTS "callingName";

WITH ranked AS (
  SELECT
    "id",
    EXTRACT(YEAR FROM COALESCE("dateIssued", "createdAt"))::int AS reference_year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM COALESCE("dateIssued", "createdAt"))::int
      ORDER BY COALESCE("dateIssued", "createdAt"), "id"
    ) AS sequence_number
  FROM "Donor"
)
UPDATE "Donor" AS donor
SET "donorNumber" = 'DON-' || ranked.reference_year || '-' || LPAD(ranked.sequence_number::text, 5, '0')
FROM ranked
WHERE donor."id" = ranked."id";
