CREATE TYPE "HospitalBloodTransferStatus" AS ENUM ('ACCEPTED', 'DISPATCHED', 'RECEIVED', 'CANCELLED');

CREATE TABLE "HospitalBloodTransfer" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "responseId" TEXT NOT NULL,
    "supplyingHospitalId" TEXT NOT NULL,
    "receivingHospitalId" TEXT NOT NULL,
    "bloodGroup" "BloodGroup" NOT NULL,
    "units" INTEGER NOT NULL,
    "dispatchedUnits" INTEGER,
    "receivedUnits" INTEGER,
    "status" "HospitalBloodTransferStatus" NOT NULL DEFAULT 'ACCEPTED',
    "dispatchNote" TEXT,
    "dispatchReference" TEXT,
    "receivedNote" TEXT,
    "receivedCondition" TEXT,
    "dispatchedAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalBloodTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HospitalBloodTransfer_responseId_key" ON "HospitalBloodTransfer"("responseId");
CREATE INDEX "HospitalBloodTransfer_requestId_idx" ON "HospitalBloodTransfer"("requestId");
CREATE INDEX "HospitalBloodTransfer_supplyingHospitalId_idx" ON "HospitalBloodTransfer"("supplyingHospitalId");
CREATE INDEX "HospitalBloodTransfer_receivingHospitalId_idx" ON "HospitalBloodTransfer"("receivingHospitalId");
CREATE INDEX "HospitalBloodTransfer_status_idx" ON "HospitalBloodTransfer"("status");
CREATE INDEX "HospitalBloodTransfer_createdAt_idx" ON "HospitalBloodTransfer"("createdAt");

ALTER TABLE "HospitalBloodTransfer" ADD CONSTRAINT "HospitalBloodTransfer_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalBloodTransfer" ADD CONSTRAINT "HospitalBloodTransfer_responseId_fkey" FOREIGN KEY ("responseId") REFERENCES "HospitalBloodRequestResponse"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalBloodTransfer" ADD CONSTRAINT "HospitalBloodTransfer_supplyingHospitalId_fkey" FOREIGN KEY ("supplyingHospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalBloodTransfer" ADD CONSTRAINT "HospitalBloodTransfer_receivingHospitalId_fkey" FOREIGN KEY ("receivingHospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
