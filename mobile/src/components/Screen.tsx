import { PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../hooks/useTheme';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({ children, style, refreshing = false, onRefresh }: Props) {
  const { colors } = useTheme();
  return (
    <ScrollView
      contentContainerStyle={[styles.content, { backgroundColor: colors.background }, style]}
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    flexGrow: 1,
    gap: 14,
    padding: 16,
    paddingBottom: 120,
  },
});
