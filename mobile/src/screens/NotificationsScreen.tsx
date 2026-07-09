import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { colors } from '../constants/colors';
import { getNotifications, markNotificationDelivered, NotificationItem } from '../services/notifications';
import { DonorTabsParamList } from '../types/navigation';
import { formatDateTime } from '../utils/format';

function isEmergency(item: NotificationItem) {
  return Boolean(item.bloodRequestId || item.type?.toLowerCase().includes('emergency') || item.title.toLowerCase().includes('urgent'));
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

      {message ? <Text style={styles.error}>{message}</Text> : null}
      {loading ? <Text style={styles.muted}>Loading notifications...</Text> : null}
      {!loading && items.length === 0 ? <AppCard><Text style={styles.muted}>No notifications yet. Emergency alerts and appointment updates will appear here.</Text></AppCard> : null}
      {items.map((item) => (
        <Pressable key={item.id} onPress={() => void openNotification(item)} style={({ pressed }) => [styles.card, isEmergency(item) && styles.emergencyCard, !item.delivered && styles.unreadCard, pressed && styles.pressed]}>
          <View style={styles.rowBetween}>
            <Text style={styles.cardTitle}>{item.title}</Text>
            <StatusBadge label={item.delivered ? 'Read' : 'New'} tone={item.delivered ? 'muted' : 'primary'} />
          </View>
          {isEmergency(item) ? <StatusBadge label="Emergency Alert" tone="danger" /> : null}
          {item.body ? <Text style={styles.body}>{item.body}</Text> : null}
          <Text style={styles.muted}>{formatDateTime(item.createdAt)}</Text>
          {item.bloodRequestId ? <Text style={styles.link}>View Alert</Text> : null}
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  error: { borderRadius: 12, backgroundColor: '#fef2f2', color: colors.danger, padding: 10, fontWeight: '800' },
  summaryRow: { flexDirection: 'row', gap: 10 },
  summaryCard: { flex: 1, minHeight: 88 },
  summaryValue: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  summaryLabel: { color: colors.muted, fontWeight: '800' },
  card: { gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: '#fff', padding: 14 },
  emergencyCard: { borderColor: '#fecaca', backgroundColor: '#fff7f7' },
  unreadCard: { borderColor: colors.primary },
  pressed: { opacity: 0.86 },
  rowBetween: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  cardTitle: { flex: 1, color: colors.ink, fontWeight: '900', fontSize: 17 },
  body: { color: colors.ink, lineHeight: 21 },
  link: { color: colors.primary, fontWeight: '900' },
});
