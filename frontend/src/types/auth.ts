export type Role = 'ADMIN' | 'DONOR' | 'HOSPITAL_ADMIN';

export const ADMIN_PORTAL_ROLES: Role[] = ['ADMIN'];

export const HOSPITAL_PORTAL_ROLES: Role[] = ['HOSPITAL_ADMIN'];

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  profileImageUrl?: string | null;
  profileImageUpdatedAt?: string | null;
}

export interface AuthSession {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}
