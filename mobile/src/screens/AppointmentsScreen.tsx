import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../components/AppCard';
import { EmptyState } from '../components/EmptyState';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { colors } from '../constants/colors';
import { Appointment, getAppointments } from '../services/appointments';
import { formatDateTime } from '../utils/format';
import { spacing, typography } from '../theme/design';

function statusTone(status: string): 'success' | 'warning' | 'danger' | 'muted' | 'primary' {
  if (status === 'COMPLETED') return 'success';
  if (status === 'CANCELLED' || status === 'MISSED' || status === 'NO_SHOW') return 'danger';
  if (status === 'SCHEDULED' || status === 'CONFIRMED') return 'primary';
  return 'muted';
}

function isPast(item: Appointment) {
  return new Date(item.scheduledAt).getTime() < Date.now() || ['COMPLETED', 'CANCELLED', 'MISSED', 'NO_SHOW'].includes(item.status);
}

export function AppointmentsScreen() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      setItems(await getAppointments({ take: 30 }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load appointments.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const upcoming = useMemo(() => items.filter((item) => !isPast(item)), [items]);
  const past = useMemo(() => items.filter(isPast), [items]);

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard>
        <Text style={styles.title}>Appointments</Text>
        <Text style={styles.muted}>Your hospital screening and donation schedule.</Text>
      </AppCard>
      <FeedbackMessage message={message} tone="danger" />
      {!loading && items.length === 0 ? <EmptyState icon="calendar-outline" title="No Appointments Yet" message="No appointment has been scheduled for this donor account yet." /> : null}

      {upcoming.length > 0 ? <Text style={styles.section}>Upcoming</Text> : null}
      {upcoming.map((item) => <AppointmentCard key={item.id} item={item} />)}

      {past.length > 0 ? <Text style={styles.section}>Past Appointments</Text> : null}
      {past.map((item) => <AppointmentCard key={item.id} item={item} />)}
    </Screen>
  );
}

function AppointmentCard({ item }: { item: Appointment }) {
  const location = [item.hospital?.city, item.hospital?.region].filter(Boolean).join(', ') || item.hospital?.location || 'Location not recorded';
  return (
    <AppCard>
      <View style={styles.rowBetween}>
        <Text style={styles.ref}>{item.appointmentReference ?? item.id}</Text>
        <StatusBadge label={item.status} tone={statusTone(item.status)} />
      </View>
      <Text style={styles.detail}>Hospital: {item.hospital?.hospitalName ?? 'Hospital not recorded'}</Text>
      <Text style={styles.detail}>Type: {item.appointmentType ?? 'Blood Donation'}</Text>
      <Text style={styles.detail}>Date/Time: {formatDateTime(item.scheduledAt)}</Text>
      <Text style={styles.detail}>Location: {location}</Text>
      {item.notes ? <Text style={styles.muted}>Notes: {item.notes}</Text> : null}
    </AppCard>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, ...typography.screenTitle },
  muted: { color: colors.muted, ...typography.body },
  section: { color: colors.ink, ...typography.sectionTitle, marginTop: spacing.xs },
  ref: { color: colors.primaryDark, fontSize: 18, fontWeight: '900', flex: 1 },
  detail: { color: colors.ink, ...typography.body },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing.md },
});
