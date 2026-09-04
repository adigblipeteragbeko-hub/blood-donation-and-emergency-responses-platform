import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';
import { radius, spacing, typography } from '../theme/design';
import { Ionicons } from '@expo/vector-icons';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger' | 'muted';
  style?: ViewStyle;
  icon?: keyof typeof Ionicons.glyphMap;
};

export function AppButton({ title, onPress, disabled, loading, variant = 'primary', style, icon }: Props) {
  const { colors } = useTheme();
  const variants = {
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    outline: { backgroundColor: colors.elevated ?? colors.card, borderColor: colors.border },
    danger: { backgroundColor: colors.danger, borderColor: colors.danger },
    muted: { backgroundColor: colors.cardMuted, borderColor: colors.border },
  };
  const textColor = {
    primary: colors.white ?? '#fff',
    outline: colors.primaryDark,
    danger: colors.white ?? '#fff',
    muted: colors.ink,
  }[variant];
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        variants[variant],
        (disabled || loading) && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? colors.white ?? '#fff' : colors.primary} />
      ) : (
        <View style={styles.content}>
          {icon ? <Ionicons name={icon} size={18} color={textColor} /> : null}
          <Text style={[styles.text, { color: textColor }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
  },
  disabled: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.99 }] },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
  text: typography.button,
});
