import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { radius, spacing, typography } from '../theme/design';

export function EmptyState({
  icon = 'information-circle-outline',
  title,
  message,
}: {
  icon?: keyof typeof Ionicons.glyphMap;
  title: string;
  message: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: colors.primarySoft }]}>
        <Ionicons name={icon} size={24} color={colors.primaryDark} />
      </View>
      <Text style={[styles.title, { color: colors.ink }]}>{title}</Text>
      <Text style={[styles.message, { color: colors.muted }]}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', paddingVertical: spacing['2xl'] },
  iconWrap: { width: 52, height: 52, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.cardTitle, textAlign: 'center' },
  message: { ...typography.body, textAlign: 'center' },
});
