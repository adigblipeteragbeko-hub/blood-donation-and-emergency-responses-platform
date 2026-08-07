import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export function StatusBadge({ label, tone = 'muted' }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const tones = {
    success: { backgroundColor: colors.successSoft, color: colors.success },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
    muted: { backgroundColor: colors.border, color: colors.muted },
    primary: { backgroundColor: colors.primarySoft, color: colors.primaryDark },
  };
  return <Text style={[styles.badge, tones[tone]]}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: 999,
    overflow: 'hidden',
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 12,
    fontWeight: '900',
  },
});
