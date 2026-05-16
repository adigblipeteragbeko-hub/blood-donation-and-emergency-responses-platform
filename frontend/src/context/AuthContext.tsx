import { createContext, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { AuthSession, AuthUser } from '../types/auth';
import { unwrapApiResponse } from '../utils/api-response';

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

export const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
});

function readStoredUser() {
  try {
    const raw = localStorage.getItem('user');
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    localStorage.removeItem('user');
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('user');
    setUser(null);
  };

  const saveSession = (payload: AuthSession) => {
    localStorage.setItem('accessToken', payload.accessToken);
    localStorage.setItem('refreshToken', payload.refreshToken);
    localStorage.setItem('user', JSON.stringify(payload.user));
    setUser(payload.user);
  };

  useEffect(() => {
    let mounted = true;

    const hydrate = async () => {
      const accessToken = localStorage.getItem('accessToken');
      const refreshToken = localStorage.getItem('refreshToken');

      if (!accessToken && !refreshToken) {
        if (mounted) {
          clearSession();
          setLoading(false);
        }
        return;
      }

      try {
        const response = await api.post('/auth/me');
        const currentUser = unwrapApiResponse<AuthUser>(response.data);
        if (mounted) {
          localStorage.setItem('user', JSON.stringify(currentUser));
          setUser(currentUser);
        }
      } catch {
        if (!refreshToken) {
          if (mounted) {
            clearSession();
          }
          return;
        }

        try {
          const response = await api.post('/auth/refresh', null, {
            headers: { Authorization: `Bearer ${refreshToken}` },
          });
          const tokens = unwrapApiResponse<{ accessToken: string; refreshToken: string }>(response.data);
          const storedUser = readStoredUser();

          if (!storedUser) {
            throw new Error('Missing stored user for refreshed session');
          }

          if (mounted) {
            saveSession({ ...tokens, user: storedUser });
          }
        } catch {
          if (mounted) {
            clearSession();
          }
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    void hydrate();

    return () => {
      mounted = false;
    };
  }, []);

  const login = async (email: string, password: string) => {
    const response = await api.post('/auth/login', { email, password });
    const payload = unwrapApiResponse<AuthSession>(response.data);
    saveSession(payload);
  };

  const logout = () => {
    clearSession();
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [loading, user]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
