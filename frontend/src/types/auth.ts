export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'DONOR'
  | 'HOSPITAL_STAFF'
  | 'BLOOD_BANK_OFFICER';

export const ADMIN_PORTAL_ROLES: Role[] = [
  'SUPER_ADMIN',
  'ADMIN',
];

export const HOSPITAL_PORTAL_ROLES: Role[] = [
  'HOSPITAL_STAFF',
  'BLOOD_BANK_OFFICER',
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
