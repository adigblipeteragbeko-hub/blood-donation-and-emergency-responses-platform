export type Role = 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF';

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
