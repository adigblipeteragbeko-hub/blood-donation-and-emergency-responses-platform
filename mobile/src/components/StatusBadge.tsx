import { StyleSheet, Text } from 'react-native';
import { colors } from '../constants/colors';

type Tone = 'success' | 'warning' | 'danger' | 'muted' | 'primary';

export function StatusBadge({ label, tone = 'muted' }: { label: string; tone?: Tone }) {
  return <Text style={[styles.badge, styles[tone]]}>{label}</Text>;
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
  success: { backgroundColor: colors.successSoft, color: colors.success },
  warning: { backgroundColor: colors.warningSoft, color: colors.warning },
  danger: { backgroundColor: '#fef2f2', color: colors.danger },
  muted: { backgroundColor: '#f3f4f6', color: colors.muted },
  primary: { backgroundColor: colors.primarySoft, color: colors.primaryDark },
});
