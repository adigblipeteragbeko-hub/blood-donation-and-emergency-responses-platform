import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type Size = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

const sizes: Record<Size, number> = {
  xs: 30,
  sm: 40,
  md: 50,
  lg: 66,
  xl: 118,
};

function initials(name?: string | null, email?: string | null) {
  const source = name?.trim() || email?.split('@')[0]?.replace(/[._-]+/g, ' ') || 'Donor';
  const words = source.split(/\s+/).filter(Boolean);
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0]?.[0] ?? 'D'}${words[words.length - 1]?.[0] ?? ''}`.toUpperCase();
}

export function SmartAvatar({ name, email, src, size = 'md' }: { name?: string | null; email?: string | null; src?: string | null; size?: Size }) {
  const { colors } = useTheme();
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const dimension = sizes[size];
  const label = useMemo(() => initials(name, email), [email, name]);

  useEffect(() => {
    setFailed(false);
    setLoaded(false);
  }, [src]);

  if (src && !failed) {
    return (
      <View
        accessibilityLabel={name ? `${name} profile avatar` : 'Profile avatar'}
        accessibilityRole="image"
        style={[styles.imageShell, { width: dimension, height: dimension, borderRadius: dimension / 2, borderColor: colors.border, backgroundColor: colors.primarySoft }]}
      >
        {!loaded ? <ActivityIndicator color={colors.primary} size={dimension > 60 ? 'small' : 'small'} /> : null}
        <Image
          source={{ uri: src }}
          resizeMode="cover"
          onError={() => setFailed(true)}
          onLoad={() => setLoaded(true)}
          style={[styles.image, { width: dimension, height: dimension, borderRadius: dimension / 2, opacity: loaded ? 1 : 0 }]}
        />
      </View>
    );
  }

  return (
    <View
      accessibilityLabel={name ? `${name} initials avatar` : 'Initials avatar'}
      accessibilityRole="image"
      style={[styles.fallback, { width: dimension, height: dimension, borderRadius: dimension / 2, backgroundColor: colors.primary }]}
    >
      <Text style={[styles.initials, { fontSize: Math.max(12, dimension * 0.32) }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  imageShell: { alignItems: 'center', borderWidth: 2, justifyContent: 'center', overflow: 'hidden' },
  image: { position: 'absolute' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initials: { color: '#fff', fontWeight: '900' },
});
