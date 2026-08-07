import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger' | 'muted';
  style?: ViewStyle;
};

export function AppButton({ title, onPress, disabled, loading, variant = 'primary', style }: Props) {
  const { colors } = useTheme();
  const variants = {
    primary: { backgroundColor: colors.primary, borderColor: colors.primary },
    outline: { backgroundColor: colors.card, borderColor: '#fecaca' },
    danger: { backgroundColor: colors.danger, borderColor: colors.danger },
    muted: { backgroundColor: colors.border, borderColor: colors.border },
  };
  const textColor = {
    primary: '#fff',
    outline: colors.primaryDark,
    danger: '#fff',
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
      {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary} /> : <Text style={[styles.text, { color: textColor }]}>{title}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  disabled: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.99 }] },
  text: { fontWeight: '800', fontSize: 15 },
});
