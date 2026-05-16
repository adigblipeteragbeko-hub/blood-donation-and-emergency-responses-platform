import { ADMIN_PORTAL_ROLES, HOSPITAL_PORTAL_ROLES, Role } from '../types/auth';

export function getRoleLandingPath(role?: Role | null) {
  if (!role) {
    return '/login';
  }

  if (role === 'WEBSITE_CONTENT_ADMIN') {
    return '/admin/website-management';
  }

  if (ADMIN_PORTAL_ROLES.includes(role)) {
    return '/admin/dashboard';
  }

  if (role === 'DONOR') {
    return '/donor/dashboard';
  }

  if (role === 'INVENTORY_OFFICER') {
    return '/hospital/inventory';
  }

  if (HOSPITAL_PORTAL_ROLES.includes(role)) {
    return '/hospital/dashboard';
  }

  return '/login';
}
