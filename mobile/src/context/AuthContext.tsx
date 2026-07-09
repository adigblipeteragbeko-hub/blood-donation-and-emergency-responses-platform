import { createContext, PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { readStoredUser } from '../services/api';
import { AuthUser, getCurrentUser, loginDonor, logoutDonor } from '../services/auth';

type AuthContextValue = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: PropsWithChildren) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const hydrate = async () => {
      try {
        const storedUser = await readStoredUser<AuthUser>();
        if (!storedUser) return;
        const currentUser = await getCurrentUser().catch(() => storedUser);
        if (currentUser.role === 'DONOR') {
          setUser(currentUser);
        } else {
          await logoutDonor();
        }
      } finally {
        setLoading(false);
      }
    };
    void hydrate();
  }, []);

  const login = async (email: string, password: string) => {
    const nextUser = await loginDonor(email, password);
    setUser(nextUser);
  };

  const logout = async () => {
    await logoutDonor();
    setUser(null);
  };

  const value = useMemo(() => ({ user, loading, login, logout }), [user, loading]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
