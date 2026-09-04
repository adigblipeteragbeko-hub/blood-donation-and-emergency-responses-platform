export type ThemePreference = 'light' | 'dark' | 'system';
export type ResolvedTheme = 'light' | 'dark';

export const mobileThemeStorageKey = 'blood-platform-mobile-theme';

export const lightColors = {
  primary: '#c8102e',
  primaryDark: '#991b1b',
  primarySoft: '#fef2f2',
  danger: '#dc2626',
  dangerSoft: '#fef2f2',
  success: '#047857',
  successSoft: '#ecfdf5',
  warning: '#b45309',
  warningSoft: '#fffbeb',
  info: '#2563eb',
  infoSoft: '#eff6ff',
  ink: '#111827',
  muted: '#6b7280',
  border: '#e5e7eb',
  card: '#ffffff',
  cardMuted: '#f8fafc',
  background: '#f8fafc',
  focus: '#fb7185',
  disabled: '#94a3b8',
  subtle: '#64748b',
  elevated: '#ffffff',
  white: '#ffffff',
  textOnLight: '#111827',
  mutedOnLight: '#64748b',
  borderOnLight: '#e5e7eb',
};

export const darkColors = {
  primary: '#fb365b',
  primaryDark: '#ffb4c0',
  primarySoft: '#3b111b',
  danger: '#fb7185',
  dangerSoft: '#3b111b',
  success: '#34d399',
  successSoft: '#0f2f24',
  warning: '#fbbf24',
  warningSoft: '#33260b',
  info: '#60a5fa',
  infoSoft: '#10233f',
  ink: '#f8fafc',
  muted: '#cbd5e1',
  border: '#334155',
  card: '#1f2937',
  cardMuted: '#263244',
  background: '#111827',
  focus: '#fb7185',
  disabled: '#64748b',
  subtle: '#94a3b8',
  elevated: '#273449',
  white: '#ffffff',
  textOnLight: '#111827',
  mutedOnLight: '#64748b',
  borderOnLight: '#e5e7eb',
};

export function colorsForTheme(theme: ResolvedTheme) {
  return theme === 'dark' ? darkColors : lightColors;
}
