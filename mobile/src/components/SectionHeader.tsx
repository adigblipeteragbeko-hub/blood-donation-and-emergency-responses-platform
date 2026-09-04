import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { spacing, typography } from '../theme/design';

export function SectionHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.wrap}>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      {subtitle ? <Text style={[styles.subtitle, { color: colors.muted }]}>{subtitle}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  title: typography.sectionTitle,
  subtitle: typography.body,
});
