CREATE TYPE "HospitalRequestResponseType" AS ENUM ('OFFERED', 'CANNOT_FULFILL');
CREATE TYPE "HospitalRequestResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'REJECTED', 'CANCELLED');

CREATE TABLE "HospitalBloodRequestResponse" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "respondingHospitalId" TEXT NOT NULL,
    "responseType" "HospitalRequestResponseType" NOT NULL,
    "unitsOffered" INTEGER,
    "bloodGroupOffered" "BloodGroup",
    "note" TEXT,
    "status" "HospitalRequestResponseStatus" NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalBloodRequestResponse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "HospitalBloodRequestResponse_requestId_respondingHospitalId_key" ON "HospitalBloodRequestResponse"("requestId", "respondingHospitalId");
CREATE INDEX "HospitalBloodRequestResponse_requestId_idx" ON "HospitalBloodRequestResponse"("requestId");
CREATE INDEX "HospitalBloodRequestResponse_respondingHospitalId_idx" ON "HospitalBloodRequestResponse"("respondingHospitalId");
CREATE INDEX "HospitalBloodRequestResponse_responseType_idx" ON "HospitalBloodRequestResponse"("responseType");
CREATE INDEX "HospitalBloodRequestResponse_status_idx" ON "HospitalBloodRequestResponse"("status");
CREATE INDEX "HospitalBloodRequestResponse_createdAt_idx" ON "HospitalBloodRequestResponse"("createdAt");

ALTER TABLE "HospitalBloodRequestResponse" ADD CONSTRAINT "HospitalBloodRequestResponse_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "HospitalBloodRequestResponse" ADD CONSTRAINT "HospitalBloodRequestResponse_respondingHospitalId_fkey" FOREIGN KEY ("respondingHospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
