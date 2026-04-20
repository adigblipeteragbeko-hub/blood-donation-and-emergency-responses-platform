import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { authStorageKeys } from '../constants/storageKeys';
import { authApi, DonorRegisterPayload } from '../services/api';

export type AuthUser = {
  id: string;
  email: string;
  role: 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF';
};

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  registerDonor: (payload: DonorRegisterPayload) => Promise<{ email: string }>;
  verifyEmail: (email: string, code: string) => Promise<void>;
  resendVerification: (email: string) => Promise<void>;
  logout: () => Promise<void>;
};

const { ACCESS_KEY, REFRESH_KEY, USER_KEY } = authStorageKeys;

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  registerDonor: async () => ({ email: '' }),
  verifyEmail: async () => {},
  resendVerification: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const rawUser = await AsyncStorage.getItem(USER_KEY);
        const token = await AsyncStorage.getItem(ACCESS_KEY);
        if (rawUser && token) {
          setUser(JSON.parse(rawUser) as AuthUser);
        }
      } finally {
        setLoading(false);
      }
    };
    void hydrate();
  }, []);

  const login = async (email: string, password: string) => {
    const session = await authApi.login(email, password);
    if (session.user.role !== 'DONOR') {
      throw new Error('Mobile app currently supports donor accounts only.');
    }
    await AsyncStorage.multiSet([
      [ACCESS_KEY, session.accessToken],
      [REFRESH_KEY, session.refreshToken],
      [USER_KEY, JSON.stringify(session.user)],
    ]);
    setUser(session.user);
  };

  const registerDonor = async (payload: DonorRegisterPayload) => {
    return authApi.registerDonor(payload);
  };

  const verifyEmail = async (email: string, code: string) => {
    await authApi.verifyEmail(email, code);
  };

  const resendVerification = async (email: string) => {
    await authApi.resendVerification(email);
  };

  const logout = async () => {
    try {
      const refreshToken = await AsyncStorage.getItem(REFRESH_KEY);
      if (refreshToken) {
        await authApi.logout(refreshToken);
      }
    } catch {
      // best-effort logout
    } finally {
      await AsyncStorage.multiRemove([ACCESS_KEY, REFRESH_KEY, USER_KEY]);
      setUser(null);
    }
  };

  const value = useMemo<AuthContextValue>(
    () => ({ user, loading, login, registerDonor, verifyEmail, resendVerification, logout }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
