import { createContext, PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { colorsForTheme, mobileThemeStorageKey, ResolvedTheme, ThemePreference } from '../theme/colors';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: ResolvedTheme;
  colors: ReturnType<typeof colorsForTheme>;
  loading: boolean;
  setPreference: (preference: ThemePreference) => Promise<void>;
};

export const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  resolvedTheme: 'light',
  colors: colorsForTheme('light'),
  loading: true,
  setPreference: async () => undefined,
});

function normalize(value?: string | null): ThemePreference {
  return value === 'light' || value === 'dark' || value === 'system' ? value : 'system';
}

export function ThemeProvider({ children }: PropsWithChildren) {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    SecureStore.getItemAsync(mobileThemeStorageKey)
      .then((stored) => setPreferenceState(normalize(stored)))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const subscription = Appearance.addChangeListener(() => undefined);
    return () => subscription.remove();
  }, []);

  const resolvedTheme: ResolvedTheme = preference === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : preference;

  const setPreference = async (next: ThemePreference) => {
    setPreferenceState(next);
    await SecureStore.setItemAsync(mobileThemeStorageKey, next);
  };

  const value = useMemo(
    () => ({ preference, resolvedTheme, colors: colorsForTheme(resolvedTheme), loading, setPreference }),
    [loading, preference, resolvedTheme],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
