import { ActivityIndicator, Pressable, StyleSheet, Text, ViewStyle } from 'react-native';
import { colors } from '../constants/colors';

type Props = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
  variant?: 'primary' | 'outline' | 'danger' | 'muted';
  style?: ViewStyle;
};

export function AppButton({ title, onPress, disabled, loading, variant = 'primary', style }: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.base,
        styles[variant],
        (disabled || loading) && styles.disabled,
        pressed && !disabled ? styles.pressed : null,
        style,
      ]}
    >
      {loading ? <ActivityIndicator color={variant === 'primary' || variant === 'danger' ? '#fff' : colors.primary} /> : <Text style={[styles.text, styles[`${variant}Text`]]}>{title}</Text>}
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
  primary: { backgroundColor: colors.primary, borderColor: colors.primary },
  outline: { backgroundColor: '#fff', borderColor: '#fecaca' },
  danger: { backgroundColor: colors.danger, borderColor: colors.danger },
  muted: { backgroundColor: '#f3f4f6', borderColor: colors.border },
  disabled: { opacity: 0.55 },
  pressed: { transform: [{ scale: 0.99 }] },
  text: { fontWeight: '800', fontSize: 15 },
  primaryText: { color: '#fff' },
  outlineText: { color: colors.primaryDark },
  dangerText: { color: '#fff' },
  mutedText: { color: colors.ink },
});
