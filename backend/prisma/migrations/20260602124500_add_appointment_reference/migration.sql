ALTER TABLE "Appointment" ADD COLUMN "appointmentReference" TEXT;

WITH ranked_appointments AS (
  SELECT
    id,
    EXTRACT(YEAR FROM COALESCE("createdAt", NOW()))::INT AS appointment_year,
    ROW_NUMBER() OVER (
      PARTITION BY EXTRACT(YEAR FROM COALESCE("createdAt", NOW()))::INT
      ORDER BY COALESCE("createdAt", NOW()), id
    ) AS sequence_number
  FROM "Appointment"
  WHERE "appointmentReference" IS NULL
)
UPDATE "Appointment" AS appointment
SET "appointmentReference" = CONCAT(
  'APT-',
  ranked.appointment_year,
  '-',
  LPAD(ranked.sequence_number::TEXT, 5, '0')
)
FROM ranked_appointments AS ranked
WHERE appointment.id = ranked.id;

ALTER TABLE "Appointment" ALTER COLUMN "appointmentReference" SET NOT NULL;

CREATE UNIQUE INDEX "Appointment_appointmentReference_key" ON "Appointment"("appointmentReference");
CREATE INDEX "Appointment_appointmentReference_idx" ON "Appointment"("appointmentReference");
