-- Enterprise RBAC and hospital staff operations.
-- This migration is intentionally defensive because some development databases
-- may already contain parts of this structure from earlier local runs.

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'PermissionCode') THEN
    CREATE TYPE "PermissionCode" AS ENUM (
      'PLATFORM_ANALYTICS_VIEW',
      'PLATFORM_SECURITY_VIEW',
      'RBAC_MANAGE',
      'HOSPITAL_APPROVE',
      'ACCOUNT_SUSPEND',
      'EMERGENCY_OVERRIDE',
      'NATIONAL_ALERT_BROADCAST',
      'WEBSITE_CONTENT_MANAGE',
      'AUDIT_LOG_VIEW',
      'AUDIT_LOG_EXPORT',
      'HOSPITAL_OPERATIONS_VIEW',
      'HOSPITAL_STAFF_MANAGE',
      'HOSPITAL_SETTINGS_MANAGE',
      'INVENTORY_MANAGE',
      'INVENTORY_REPORT_VIEW',
      'DONOR_REVIEW_MANAGE',
      'DONOR_REVIEW_APPROVE',
      'BLOOD_REQUEST_CREATE',
      'BLOOD_REQUEST_APPROVE',
      'BLOOD_REQUEST_PROGRESS_UPDATE',
      'DONOR_MATCH_VIEW',
      'APPOINTMENT_MANAGE',
      'REPORT_VIEW',
      'SECURITY_MONITOR_VIEW',
      'GLOBAL_SEARCH_USE'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'DepartmentType') THEN
    CREATE TYPE "DepartmentType" AS ENUM (
      'ADMINISTRATION',
      'EMERGENCY',
      'LABORATORY',
      'BLOOD_BANK',
      'DONOR_SERVICES',
      'COMPLIANCE',
      'OPERATIONS'
    );
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'StaffAccountStatus') THEN
    CREATE TYPE "StaffAccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED');
  END IF;
END $$;

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SUPER_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'HOSPITAL_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'INVENTORY_OFFICER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'DONOR_REVIEW_OFFICER';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'WEBSITE_CONTENT_ADMIN';
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'AUDITOR';

ALTER TABLE "AuditLog" ADD COLUMN IF NOT EXISTS "device" TEXT;

ALTER TABLE "DonorEligibilityReview"
  ADD COLUMN IF NOT EXISTS "clinicalRiskFlag" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "clinicalRiskNotes" TEXT;

ALTER TABLE "Hospital"
  ADD COLUMN IF NOT EXISTS "approvalNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "approvedById" TEXT,
  ADD COLUMN IF NOT EXISTS "isApproved" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "SecurityEvent" ADD COLUMN IF NOT EXISTS "device" TEXT;

CREATE TABLE IF NOT EXISTS "HospitalDepartment" (
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

CREATE TABLE IF NOT EXISTS "StaffProfile" (
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

CREATE TABLE IF NOT EXISTS "RolePermission" (
  "id" TEXT NOT NULL,
  "role" "Role" NOT NULL,
  "permission" "PermissionCode" NOT NULL,
  "isGranted" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UserPermissionOverride" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "permission" "PermissionCode" NOT NULL,
  "isGranted" BOOLEAN NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UserPermissionOverride_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "SessionLog" (
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

CREATE INDEX IF NOT EXISTS "HospitalDepartment_hospitalId_type_idx" ON "HospitalDepartment"("hospitalId", "type");
CREATE INDEX IF NOT EXISTS "HospitalDepartment_createdAt_idx" ON "HospitalDepartment"("createdAt");
CREATE UNIQUE INDEX IF NOT EXISTS "HospitalDepartment_hospitalId_name_key" ON "HospitalDepartment"("hospitalId", "name");

CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_userId_key" ON "StaffProfile"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "StaffProfile_employeeCode_key" ON "StaffProfile"("employeeCode");
CREATE INDEX IF NOT EXISTS "StaffProfile_hospitalId_idx" ON "StaffProfile"("hospitalId");
CREATE INDEX IF NOT EXISTS "StaffProfile_departmentId_idx" ON "StaffProfile"("departmentId");
CREATE INDEX IF NOT EXISTS "StaffProfile_status_idx" ON "StaffProfile"("status");
CREATE INDEX IF NOT EXISTS "StaffProfile_createdAt_idx" ON "StaffProfile"("createdAt");

CREATE INDEX IF NOT EXISTS "RolePermission_role_idx" ON "RolePermission"("role");
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_role_permission_key" ON "RolePermission"("role", "permission");

CREATE INDEX IF NOT EXISTS "UserPermissionOverride_userId_idx" ON "UserPermissionOverride"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "UserPermissionOverride_userId_permission_key" ON "UserPermissionOverride"("userId", "permission");

CREATE INDEX IF NOT EXISTS "SessionLog_userId_createdAt_idx" ON "SessionLog"("userId", "createdAt");
CREATE INDEX IF NOT EXISTS "SessionLog_expiresAt_idx" ON "SessionLog"("expiresAt");
CREATE INDEX IF NOT EXISTS "SessionLog_isSuspicious_createdAt_idx" ON "SessionLog"("isSuspicious", "createdAt");

CREATE INDEX IF NOT EXISTS "Hospital_isApproved_idx" ON "Hospital"("isApproved");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'Hospital_approvedById_fkey') THEN
    ALTER TABLE "Hospital" ADD CONSTRAINT "Hospital_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'HospitalDepartment_hospitalId_fkey') THEN
    ALTER TABLE "HospitalDepartment" ADD CONSTRAINT "HospitalDepartment_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffProfile_userId_fkey') THEN
    ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffProfile_hospitalId_fkey') THEN
    ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_hospitalId_fkey" FOREIGN KEY ("hospitalId") REFERENCES "Hospital"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'StaffProfile_departmentId_fkey') THEN
    ALTER TABLE "StaffProfile" ADD CONSTRAINT "StaffProfile_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "HospitalDepartment"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'UserPermissionOverride_userId_fkey') THEN
    ALTER TABLE "UserPermissionOverride" ADD CONSTRAINT "UserPermissionOverride_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SessionLog_userId_fkey') THEN
    ALTER TABLE "SessionLog" ADD CONSTRAINT "SessionLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
