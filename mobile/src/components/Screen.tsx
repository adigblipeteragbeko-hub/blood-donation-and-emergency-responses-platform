import { PropsWithChildren } from 'react';
import { RefreshControl, ScrollView, StyleSheet, ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../hooks/useTheme';
import { spacing } from '../theme/design';

type Props = PropsWithChildren<{
  style?: ViewStyle;
  refreshing?: boolean;
  onRefresh?: () => void;
}>;

export function Screen({ children, style, refreshing = false, onRefresh }: Props) {
  const { colors } = useTheme();
  return (
    <SafeAreaView edges={['left', 'right']} style={[styles.safe, { backgroundColor: colors.background }]}>
      <ScrollView
        style={{ backgroundColor: colors.background }}
        contentContainerStyle={[styles.content, style]}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled"
        refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} /> : undefined}
      >
        {children}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  content: {
    flexGrow: 1,
    gap: spacing.lg,
    padding: spacing.lg,
    paddingBottom: 128,
  },
});
