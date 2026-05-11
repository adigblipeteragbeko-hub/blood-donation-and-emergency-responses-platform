-- CreateEnum
CREATE TYPE "PermissionCode" AS ENUM ('PLATFORM_ANALYTICS_VIEW', 'PLATFORM_SECURITY_VIEW', 'RBAC_MANAGE', 'HOSPITAL_APPROVE', 'ACCOUNT_SUSPEND', 'EMERGENCY_OVERRIDE', 'NATIONAL_ALERT_BROADCAST', 'WEBSITE_CONTENT_MANAGE', 'AUDIT_LOG_VIEW', 'AUDIT_LOG_EXPORT', 'HOSPITAL_OPERATIONS_VIEW', 'HOSPITAL_STAFF_MANAGE', 'HOSPITAL_SETTINGS_MANAGE', 'INVENTORY_MANAGE', 'INVENTORY_REPORT_VIEW', 'DONOR_REVIEW_MANAGE', 'DONOR_REVIEW_APPROVE', 'BLOOD_REQUEST_CREATE', 'BLOOD_REQUEST_APPROVE', 'BLOOD_REQUEST_PROGRESS_UPDATE', 'DONOR_MATCH_VIEW', 'APPOINTMENT_MANAGE', 'REPORT_VIEW', 'SECURITY_MONITOR_VIEW', 'GLOBAL_SEARCH_USE');

-- CreateEnum
CREATE TYPE "DepartmentType" AS ENUM ('ADMINISTRATION', 'EMERGENCY', 'LABORATORY', 'BLOOD_BANK', 'DONOR_SERVICES', 'COMPLIANCE', 'OPERATIONS');

-- CreateEnum
CREATE TYPE "StaffAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE 'HOSPITAL_ADMIN';
ALTER TYPE "Role" ADD VALUE 'INVENTORY_OFFICER';
ALTER TYPE "Role" ADD VALUE 'DONOR_REVIEW_OFFICER';
ALTER TYPE "Role" ADD VALUE 'WEBSITE_CONTENT_ADMIN';
ALTER TYPE "Role" ADD VALUE 'AUDITOR';

-- AlterTable
ALTER TABLE "AuditLog" ADD COLUMN     "device" TEXT;

-- AlterTable
ALTER TABLE "DonorEligibilityReview" ADD COLUMN     "clinicalRiskFlag" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "clinicalRiskNotes" TEXT;

-- AlterTable
ALTER TABLE "Hospital" ADD COLUMN     "approvalNotes" TEXT,
ADD COLUMN     "approvedAt" TIMESTAMP(3),
ADD COLUMN     "approvedById" TEXT,
ADD COLUMN     "isApproved" BOOLEAN NOT NULL DEFAULT true;

-- AlterTable
ALTER TABLE "SecurityEvent" ADD COLUMN     "device" TEXT;

-- CreateTable
CREATE TABLE "HospitalDepartment" (
    "id" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "DepartmentType" NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HospitalDepartment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StaffProfile" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "hospitalId" TEXT NOT NULL,
    "departmentId" TEXT,
    "employeeCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "StaffAccountStatus" NOT NULL DEFAULT 'ACTIVE',
    "isDepartmentHead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StaffProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "id" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "permission" "PermissionCode" NOT NULL,
    "isGranted" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermissionOverride" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "permission" "PermissionCode" NOT NULL,
    "isGranted" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SessionLog" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "refreshTokenId" TEXT,
    "ipAddress" TEXT,
    "device" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "loggedOutAt" TIMESTAMP(3),
    "isSuspicious" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SessionLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "HospitalDepartment_hospitalId_type_idx" ON "HospitalDepartment"("hospitalId", "type");

-- CreateIndex
CREATE INDEX "HospitalDepartment_createdAt_idx" ON "HospitalDepartment"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "HospitalDepartment_hospitalId_name_key" ON "HospitalDepartment"("hospitalId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_userId_key" ON "StaffProfile"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "StaffProfile_employeeCode_key" ON "StaffProfile"("employeeCode");

-- CreateIndex
CREATE INDEX "StaffProfile_hospitalId_idx" ON "StaffProfile"("hospitalId");

-- CreateIndex
CREATE INDEX "StaffProfile_departmentId_idx" ON "StaffProfile"("departmentId");

-- CreateIndex
CREATE INDEX "StaffProfile_status_idx" ON "StaffProfile"("status");

-- CreateIndex
CREATE INDEX "StaffProfile_createdAt_idx" ON "StaffProfile"("createdAt");

-- CreateIndex
CREATE INDEX "RolePermission_role_idx" ON "RolePermission"("role");

-- CreateIndex
CREATE UNIQUE INDEX "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

-- CreateIndex
CREATE INDEX "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermissionOverride_userId_permission_key" ON "UserPermissionOverride"("userId", "permission");

-- CreateIndex
CREATE INDEX "SessionLog_userId_createdAt_idx" ON "SessionLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "SessionLog_expiresAt_idx" ON "SessionLog"("expiresAt");

-- CreateIndex
CREATE INDEX "SessionLog_isSuspicious_createdAt_idx" ON "SessionLog"("isSuspicious", "createdAt");

-- CreateIndex
CREATE INDEX "Hospital_isApproved_idx" ON "Hospital"("isApproved");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- AddForeignKey
ALTER TABLE "Hospital" ADD CONSTRAINT "Hospital_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HospitalDepartment" ADD CONSTRAINT "HospitalDepartment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HospitalDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

