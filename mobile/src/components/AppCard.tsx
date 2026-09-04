import { PropsWithChildren } from 'react';
import { StyleSheet, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { radius, spacing } from '../theme/design';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  variant?: 'default' | 'elevated' | 'soft' | 'white' | 'emergency';
}>;

export function AppCard({ children, style, variant = 'default' }: Props) {
  const { colors } = useTheme();
  const variants = {
    default: { borderColor: colors.border, backgroundColor: colors.card },
    elevated: { borderColor: colors.border, backgroundColor: colors.elevated ?? colors.card },
    soft: { borderColor: colors.primarySoft, backgroundColor: colors.primarySoft },
    white: { borderColor: '#e5e7eb', backgroundColor: colors.white ?? '#fff' },
    emergency: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  };
  return <View style={[styles.card, variants[variant], style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.md,
    borderWidth: 1,
    borderRadius: radius.xl,
    padding: spacing.lg,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 2,
  },
});
