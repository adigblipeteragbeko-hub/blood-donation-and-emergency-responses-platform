import { PermissionCode, Role } from '@prisma/client';

export const ROLE_PERMISSION_DEFAULTS: Record<Role, PermissionCode[]> = {
  SUPER_ADMIN: [
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
  ],
  ADMIN: [
    PermissionCode.PLATFORM_ANALYTICS_VIEW,
    PermissionCode.HOSPITAL_APPROVE,
    PermissionCode.WEBSITE_CONTENT_MANAGE,
    PermissionCode.AUDIT_LOG_VIEW,
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
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
  ],
  HOSPITAL_STAFF: [
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
    PermissionCode.INVENTORY_REPORT_VIEW,
    PermissionCode.BLOOD_REQUEST_CREATE,
    PermissionCode.BLOOD_REQUEST_PROGRESS_UPDATE,
    PermissionCode.DONOR_MATCH_VIEW,
    PermissionCode.APPOINTMENT_MANAGE,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  BLOOD_BANK_OFFICER: [
    PermissionCode.HOSPITAL_OPERATIONS_VIEW,
    PermissionCode.INVENTORY_MANAGE,
    PermissionCode.INVENTORY_REPORT_VIEW,
    PermissionCode.DONOR_REVIEW_MANAGE,
    PermissionCode.DONOR_REVIEW_APPROVE,
    PermissionCode.BLOOD_REQUEST_PROGRESS_UPDATE,
    PermissionCode.DONOR_MATCH_VIEW,
    PermissionCode.GLOBAL_SEARCH_USE,
  ],
  DONOR: [],
};

export const ROLE_INHERITANCE: Partial<Record<Role, Role[]>> = {};

export function expandRoles(role: Role): Role[] {
  const inherited = ROLE_INHERITANCE[role] ?? [];
  return [role, ...inherited];
}
