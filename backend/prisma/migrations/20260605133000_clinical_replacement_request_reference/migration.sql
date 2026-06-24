-- Store optional BDR request reference for replacement/family donor clinical records.
ALTER TABLE "DonorClinicalRecord" ADD COLUMN IF NOT EXISTS "requestReference" TEXT;
CREATE INDEX IF NOT EXISTS "DonorClinicalRecord_requestReference_idx" ON "DonorClinicalRecord"("requestReference");
