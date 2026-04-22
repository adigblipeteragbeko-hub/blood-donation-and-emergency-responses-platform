-- CreateEnum
CREATE TYPE "RequestProgressStatus" AS ENUM ('PENDING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "InventoryChangeType" AS ENUM ('ADDED', 'USED', 'EXPIRED', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "DonorResponseStatus" AS ENUM ('PENDING', 'ACCEPTED', 'DECLINED', 'DONATED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('EMERGENCY_REQUEST', 'REMINDER', 'APPOINTMENT', 'INVENTORY_ALERT', 'SYSTEM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AppointmentStatus" ADD VALUE 'CONFIRMED';
ALTER TYPE "AppointmentStatus" ADD VALUE 'MISSED';

-- AlterTable
ALTER TABLE "Appointment" ADD COLUMN     "bloodRequestId" TEXT;

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "description" TEXT,
ADD COLUMN     "ipAddress" TEXT;

-- AlterTable
ALTER TABLE "BloodRequest" ADD COLUMN     "patientCode" TEXT,
ADD COLUMN     "patientName" TEXT,
ADD COLUMN     "requestDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "trackingStatus" "RequestProgressStatus" NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE "Donation" ADD COLUMN     "bloodGroup" "BloodGroup",
ADD COLUMN     "bloodRequestId" TEXT,
ADD COLUMN     "hospitalId" TEXT,
ADD COLUMN     "screeningResult" TEXT;

-- AlterTable
ALTER TABLE "InventoryItem" ADD COLUMN     "updatedById" TEXT;

-- AlterTable
ALTER TABLE "Notification" ADD COLUMN     "isRead" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "type" "NotificationType" NOT NULL DEFAULT 'SYSTEM';

-- CreateTable
CREATE TABLE "BloodRequestUpdate" (
    "id" TEXT NOT NULL,
    "bloodRequestId" TEXT NOT NULL,
    "updatedById" TEXT,
    "oldStatus" "RequestProgressStatus",
    "newStatus" "RequestProgressStatus" NOT NULL,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BloodRequestUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryLog" (
    "id" TEXT NOT NULL,
    "inventoryId" TEXT NOT NULL,
    "changeType" "InventoryChangeType" NOT NULL,
    "unitsChanged" INTEGER NOT NULL,
    "previousUnits" INTEGER NOT NULL,
    "newUnits" INTEGER NOT NULL,
    "reason" TEXT,
    "changedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InventoryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DonorResponse" (
    "id" TEXT NOT NULL,
    "bloodRequestId" TEXT NOT NULL,
    "donorId" TEXT NOT NULL,
    "responseStatus" "DonorResponseStatus" NOT NULL DEFAULT 'PENDING',
    "responseTime" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "userId" TEXT,

    CONSTRAINT "DonorResponse_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BloodRequestUpdate_bloodRequestId_createdAt_idx" ON "BloodRequestUpdate"("bloodRequestId", "createdAt");

-- CreateIndex
CREATE INDEX "BloodRequestUpdate_createdAt_idx" ON "BloodRequestUpdate"("createdAt");

-- CreateIndex
CREATE INDEX "InventoryLog_inventoryId_createdAt_idx" ON "InventoryLog"("inventoryId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryLog_createdAt_idx" ON "InventoryLog"("createdAt");

-- CreateIndex
CREATE INDEX "DonorResponse_responseStatus_idx" ON "DonorResponse"("responseStatus");

-- CreateIndex
CREATE INDEX "DonorResponse_createdAt_idx" ON "DonorResponse"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "DonorResponse_bloodRequestId_donorId_key" ON "DonorResponse"("bloodRequestId", "donorId");

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Donation" ADD CONSTRAINT "Donation_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequestUpdate" ADD CONSTRAINT "BloodRequestUpdate_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BloodRequestUpdate" ADD CONSTRAINT "BloodRequestUpdate_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_inventoryId_fkey" FOREIGN KEY ("inventoryId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryLog" ADD CONSTRAINT "InventoryLog_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorResponse" ADD CONSTRAINT "DonorResponse_bloodRequestId_fkey" FOREIGN KEY ("bloodRequestId") REFERENCES "BloodRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorResponse" ADD CONSTRAINT "DonorResponse_donorId_fkey" FOREIGN KEY ("donorId") REFERENCES "Donor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DonorResponse" ADD CONSTRAINT "DonorResponse_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
