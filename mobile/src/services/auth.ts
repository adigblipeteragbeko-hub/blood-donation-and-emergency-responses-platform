import { api, clearStoredSession, saveStoredSession, unwrap } from './api';

export type AuthUser = {
  id: string;
  email: string;
  role: 'DONOR' | 'ADMIN' | 'SUPER_ADMIN' | 'HOSPITAL_STAFF' | 'BLOOD_BANK_OFFICER';
  isActive?: boolean;
  emailVerified?: boolean;
};

export type AuthSession = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
};

export async function loginDonor(email: string, password: string) {
  const response = await api.post('/auth/login', { email, password });
  const session = unwrap<AuthSession>(response.data);
  if (session.user.role !== 'DONOR') {
    throw new Error('This mobile app is currently for donors only. Please use the web portal.');
  }
  await saveStoredSession(session);
  return session.user;
}

export async function logoutDonor() {
  await clearStoredSession();
}

export async function getCurrentUser() {
  const response = await api.post('/auth/me');
  return unwrap<AuthUser>(response.data);
}
