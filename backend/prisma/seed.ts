import 'dotenv/config';
import { PrismaClient, PermissionCode, Role } from '@prisma/client';

const prisma = new PrismaClient();

const adminPermissions: PermissionCode[] = [
  PermissionCode.PLATFORM_ANALYTICS_VIEW,
  PermissionCode.PLATFORM_SECURITY_VIEW,
  PermissionCode.RBAC_MANAGE,
  PermissionCode.HOSPITAL_APPROVE,
  PermissionCode.ACCOUNT_SUSPEND,
  PermissionCode.EMERGENCY_OVERRIDE,
  PermissionCode.NATIONAL_ALERT_BROADCAST,
  PermissionCode.WEBSITE_CONTENT_MANAGE,
  PermissionCode.AUDIT_LOG_VIEW,
  PermissionCode.AUDIT_LOG_EXPORT,
  PermissionCode.HOSPITAL_OPERATIONS_VIEW,
  PermissionCode.HOSPITAL_SETTINGS_MANAGE,
  PermissionCode.INVENTORY_MANAGE,
  PermissionCode.INVENTORY_REPORT_VIEW,
  PermissionCode.DONOR_REVIEW_MANAGE,
  PermissionCode.DONOR_REVIEW_APPROVE,
  PermissionCode.BLOOD_REQUEST_CREATE,
  PermissionCode.BLOOD_REQUEST_APPROVE,
  PermissionCode.BLOOD_REQUEST_PROGRESS_UPDATE,
  PermissionCode.DONOR_MATCH_VIEW,
  PermissionCode.APPOINTMENT_MANAGE,
  PermissionCode.REPORT_VIEW,
  PermissionCode.SECURITY_MONITOR_VIEW,
  PermissionCode.GLOBAL_SEARCH_USE,
  PermissionCode.DONOR_CONTACT_VIEW,
  PermissionCode.DONOR_CONTACT_EXPORT,
  PermissionCode.SMS_CAMPAIGN_MANAGE,
  PermissionCode.SMS_CAMPAIGN_VIEW,
  PermissionCode.AI_INTELLIGENCE_VIEW,
  PermissionCode.AI_STOCK_RISK_VIEW,
  PermissionCode.AI_DONOR_RECOMMENDATION_VIEW,
  PermissionCode.AI_MOBILIZATION_PREVIEW,
  PermissionCode.AI_RECOMMENDATION_HISTORY_VIEW,
];

const hospitalAdminPermissions: PermissionCode[] = [
  PermissionCode.HOSPITAL_OPERATIONS_VIEW,
  PermissionCode.INVENTORY_MANAGE,
  PermissionCode.INVENTORY_REPORT_VIEW,
  PermissionCode.DONOR_REVIEW_MANAGE,
  PermissionCode.DONOR_REVIEW_APPROVE,
  PermissionCode.BLOOD_REQUEST_CREATE,
  PermissionCode.BLOOD_REQUEST_PROGRESS_UPDATE,
  PermissionCode.DONOR_MATCH_VIEW,
  PermissionCode.APPOINTMENT_MANAGE,
  PermissionCode.REPORT_VIEW,
  PermissionCode.GLOBAL_SEARCH_USE,
  PermissionCode.AI_INTELLIGENCE_VIEW,
  PermissionCode.AI_STOCK_RISK_VIEW,
  PermissionCode.AI_DONOR_RECOMMENDATION_VIEW,
  PermissionCode.AI_MOBILIZATION_PREVIEW,
  PermissionCode.AI_RECOMMENDATION_HISTORY_VIEW,
];

const rolePermissionSeeds: Record<Role, PermissionCode[]> = {
  ADMIN: adminPermissions,
  DONOR: [],
  HOSPITAL_ADMIN: hospitalAdminPermissions,
};

async function main() {
  await prisma.rolePermission.deleteMany();

  for (const [role, permissions] of Object.entries(rolePermissionSeeds) as [Role, PermissionCode[]][]) {
    for (const permission of permissions) {
      await prisma.rolePermission.create({
        data: {
          role,
          permission,
          isGranted: true,
        },
      });
    }
  }

  console.log('Seed complete: role permissions only. No demo users or fake operational data inserted.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
