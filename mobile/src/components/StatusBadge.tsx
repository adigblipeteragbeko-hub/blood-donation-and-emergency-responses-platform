import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { radius, spacing, typography } from '../theme/design';

type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export function StatusBadge({ label, tone = 'muted' }: { label: string; tone?: Tone }) {
  const { colors } = useTheme();
  const tones = {
    success: { backgroundColor: colors.successSoft, color: colors.success },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
    muted: { backgroundColor: colors.cardMuted, color: colors.muted },
    primary: { backgroundColor: colors.primarySoft, color: colors.primaryDark },
  };
  return <Text style={[styles.badge, tones[tone]]}>{label}</Text>;
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    overflow: 'hidden',
    paddingHorizontal: spacing.md,
    paddingVertical: 5,
    ...typography.badge,
  },
});
