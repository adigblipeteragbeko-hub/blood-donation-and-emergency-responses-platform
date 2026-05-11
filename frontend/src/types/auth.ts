export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'HOSPITAL_ADMIN'
  | 'DONOR'
  | 'HOSPITAL_STAFF'
  | 'INVENTORY_OFFICER'
  | 'DONOR_REVIEW_OFFICER'
  | 'WEBSITE_CONTENT_ADMIN'
  | 'AUDITOR';

export const ADMIN_PORTAL_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN',
  'WEBSITE_CONTENT_ADMIN',
  'AUDITOR',
];

export const HOSPITAL_PORTAL_ROLES: Role[] = [
  'HOSPITAL_ADMIN',
  'HOSPITAL_STAFF',
  'INVENTORY_OFFICER',
  'DONOR_REVIEW_OFFICER',
];

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
