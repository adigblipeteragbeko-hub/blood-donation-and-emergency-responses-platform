export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'blood-platform-theme';

export function getSystemTheme() {
  return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function resolveTheme(preference: ThemePreference) {
  return preference === 'system' ? getSystemTheme() : preference;
}

export function readStoredTheme(): ThemePreference {
  const stored = localStorage.getItem(THEME_STORAGE_KEY);
  return stored === 'light' || stored === 'dark' || stored === 'system' ? stored : 'system';
}

export function applyTheme(preference: ThemePreference) {
  const resolved = resolveTheme(preference);
  document.documentElement.dataset.theme = resolved;
  document.documentElement.dataset.themePreference = preference;
  document.documentElement.classList.toggle('dark', resolved === 'dark');
  localStorage.setItem(THEME_STORAGE_KEY, preference);
}
