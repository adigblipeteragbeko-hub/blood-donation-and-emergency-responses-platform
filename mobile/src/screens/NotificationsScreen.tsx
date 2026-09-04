import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { EmptyState } from '../components/EmptyState';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { colors } from '../constants/colors';
import {
  getNotifications,
  markNotificationDelivered,
  NotificationItem,
  respondToMobilizationCampaign,
} from '../services/notifications';
import { DonorTabsParamList } from '../types/navigation';
import { formatDateTime } from '../utils/format';
import { radius, spacing, typography } from '../theme/design';

function isEmergency(item: NotificationItem) {
  return Boolean(item.bloodRequestId || item.type?.toLowerCase().includes('emergency') || item.title.toLowerCase().includes('urgent'));
}

function isProactiveDonation(item: NotificationItem) {
  return item.type === 'PROACTIVE_DONATION' || Boolean(item.campaignId);
}

export function NotificationsScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<DonorTabsParamList>>();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setItems(await getNotifications({ take: 30 }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load notifications.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const unreadCount = useMemo(() => items.filter((item) => !item.delivered).length, [items]);
  const emergencyCount = useMemo(() => items.filter(isEmergency).length, [items]);

  const openNotification = async (item: NotificationItem) => {
    if (!item.delivered) {
      await markNotificationDelivered(item.id, true).catch(() => null);
      setItems((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, delivered: true } : entry));
    }
    if (item.bloodRequestId) {
      navigation.navigate('Emergency', { requestId: item.bloodRequestId });
    }
  };

  const respondToCampaign = async (item: NotificationItem, responseStatus: 'INTERESTED' | 'NOT_AVAILABLE') => {
    if (!item.campaignId) {
      return;
    }
    try {
      const result = await respondToMobilizationCampaign({ campaignId: item.campaignId, responseStatus });
      setMessage(result.message);
      await load();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to submit your response right now.');
    }
  };

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard>
        <Text style={styles.title}>Notifications</Text>
        <Text style={styles.muted}>Emergency alerts, appointments, and donor updates.</Text>
      </AppCard>

      <View style={styles.summaryRow}>
        <AppCard style={styles.summaryCard}><Text style={styles.summaryValue}>{items.length}</Text><Text style={styles.summaryLabel}>Total</Text></AppCard>
        <AppCard style={styles.summaryCard}><Text style={styles.summaryValue}>{unreadCount}</Text><Text style={styles.summaryLabel}>Unread</Text></AppCard>
        <AppCard style={styles.summaryCard}><Text style={styles.summaryValue}>{emergencyCount}</Text><Text style={styles.summaryLabel}>Emergency</Text></AppCard>
      </View>

      <FeedbackMessage message={message} tone={message.includes('Unable') ? 'danger' : 'success'} />
      {loading ? <Text style={styles.muted}>Loading notifications...</Text> : null}
      {!loading && items.length === 0 ? (
        <EmptyState icon="notifications-outline" title="No Notifications Yet" message="Emergency alerts and appointment updates will appear here." />
      ) : null}
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => void openNotification(item)} style={({ pressed }) => [styles.card, isEmergency(item) && styles.emergencyCard, !item.delivered && styles.unreadCard, pressed && styles.pressed]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <StatusBadge label={item.delivered ? 'Read' : 'New'} tone={item.delivered ? 'muted' : 'primary'} />
          </View>
          {isEmergency(item) ? <StatusBadge label="Emergency Alert" tone="danger" /> : null}
          {isProactiveDonation(item) ? <StatusBadge label="Donation Needed Soon" tone="warning" /> : null}
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
          <Text style={styles.muted}>{formatDateTime(item.createdAt)}</Text>
          {item.bloodRequestId ? <Text style={styles.link}>View Alert</Text> : null}
          {isProactiveDonation(item) && item.campaignId ? (
            <View style={styles.actionRow}>
              <AppButton title="I'm Interested" icon="heart-outline" onPress={() => void respondToCampaign(item, 'INTERESTED')} style={styles.actionButton} />
              <AppButton title="Not Available" variant="outline" onPress={() => void respondToCampaign(item, 'NOT_AVAILABLE')} style={styles.actionButton} />
            </View>
          ) : null}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, ...typography.screenTitle },
  muted: { color: colors.muted, ...typography.body },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryCard: { flex: 1, minHeight: 88, alignItems: 'center' },
  summaryValue: { color: colors.primaryDark, ...typography.stat },
  summaryLabel: { color: colors.muted, fontWeight: '800', fontSize: 12 },
  card: { gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.elevated, padding: spacing.lg },
  emergencyCard: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  unreadCard: { borderColor: colors.primary },
  pressed: { opacity: 0.86 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md },
  cardTitle: { flex: 1, color: colors.ink, ...typography.cardTitle },
  body: { color: colors.ink, ...typography.body },
  link: { color: colors.primary, fontWeight: '900' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: { flexGrow: 1, minHeight: 44 },
});
