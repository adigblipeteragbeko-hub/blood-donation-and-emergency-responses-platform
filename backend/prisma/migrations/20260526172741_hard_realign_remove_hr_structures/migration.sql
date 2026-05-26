-- AlterEnum
BEGIN;
CREATE TYPE "Role_new" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'DONOR', 'HOSPITAL_STAFF', 'BLOOD_BANK_OFFICER');
ALTER TABLE "User" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TABLE "RolePermission" ALTER COLUMN "role" TYPE "Role_new" USING ("role"::text::"Role_new");
ALTER TYPE "Role" RENAME TO "Role_old";
ALTER TYPE "Role_new" RENAME TO "Role";
DROP TYPE "Role_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "HospitalDepartment" DROP CONSTRAINT "HospitalDepartment_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "StaffProfile" DROP CONSTRAINT "StaffProfile_departmentId_fkey";

-- DropForeignKey
ALTER TABLE "StaffProfile" DROP CONSTRAINT "StaffProfile_hospitalId_fkey";

-- DropForeignKey
ALTER TABLE "StaffProfile" DROP CONSTRAINT "StaffProfile_userId_fkey";

-- DropTable
DROP TABLE "HospitalDepartment";

-- DropTable
DROP TABLE "StaffProfile";

-- DropEnum
DROP TYPE "DepartmentType";

-- DropEnum
DROP TYPE "StaffAccountStatus";


