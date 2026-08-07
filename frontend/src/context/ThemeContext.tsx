import { createContext, PropsWithChildren, useEffect, useMemo, useState } from 'react';
import { applyTheme, readStoredTheme, resolveTheme, ThemePreference } from '../utils/theme';

type ThemeContextValue = {
  preference: ThemePreference;
  resolvedTheme: 'light' | 'dark';
  setPreference: (preference: ThemePreference) => void;
};

export const ThemeContext = createContext<ThemeContextValue>({
  preference: 'system',
  resolvedTheme: 'light',
  setPreference: () => undefined,
});

export function ThemeProvider({ children }: PropsWithChildren) {
  const [preference, setPreferenceState] = useState<ThemePreference>(() => readStoredTheme());
  const [resolvedTheme, setResolvedTheme] = useState<'light' | 'dark'>(() => resolveTheme(readStoredTheme()));

  const setPreference = (next: ThemePreference) => {
    setPreferenceState(next);
    applyTheme(next);
    setResolvedTheme(resolveTheme(next));
  };

  useEffect(() => {
    applyTheme(preference);
    setResolvedTheme(resolveTheme(preference));
  }, [preference]);

  useEffect(() => {
    const media = window.matchMedia?.('(prefers-color-scheme: dark)');
    if (!media) return undefined;
    const onChange = () => {
      if (preference === 'system') {
        applyTheme('system');
        setResolvedTheme(resolveTheme('system'));
      }
    };
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [preference]);

  const value = useMemo(() => ({ preference, resolvedTheme, setPreference }), [preference, resolvedTheme]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
