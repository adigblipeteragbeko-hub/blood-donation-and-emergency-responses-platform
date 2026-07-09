import { PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { colors } from '../constants/colors';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({ children, style, refreshing = false, onRefresh }: Props) {
  return (
    <ScrollView
      contentContainerStyle={[styles.content, style]}
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
    backgroundColor: colors.background,
  },
});
