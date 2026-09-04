import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { radius, spacing, typography } from '../theme/design';

type Tone = 'success' | 'warning' | 'danger';

export function FeedbackMessage({ message, tone = 'warning' }: { message?: string; tone?: Tone }) {
  const { colors } = useTheme();
  const [visible, setVisible] = useState(Boolean(message));

  useEffect(() => {
    setVisible(Boolean(message));
    if (!message || tone !== 'success') return undefined;
    const timer = setTimeout(() => setVisible(false), 4000);
    return () => clearTimeout(timer);
  }, [message, tone]);

  if (!message || !visible) return null;
  const palette = {
    success: { backgroundColor: colors.successSoft, color: colors.success },
    warning: { backgroundColor: colors.warningSoft, color: colors.warning },
    danger: { backgroundColor: colors.dangerSoft, color: colors.danger },
  }[tone];
  return <Text style={[styles.message, palette]}>{message}</Text>;
}

const styles = StyleSheet.create({
  message: {
    borderRadius: radius.md,
    padding: spacing.md,
    ...typography.body,
    fontWeight: '800',
  },
});
