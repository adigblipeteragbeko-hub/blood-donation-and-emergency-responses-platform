import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { formatBloodGroup } from '../constants/bloodGroups';
import { colors } from '../constants/colors';
import { DonationEntry, getDonorProfile } from '../services/donor';
import { formatDate } from '../utils/format';

function statusTone(status?: string | null): 'success' | 'warning' | 'danger' | 'muted' {
  if (!status || status === 'COMPLETED' || status === 'POSTED') return 'success';
  if (status === 'CANCELLED' || status === 'FAILED') return 'danger';
  if (status === 'PENDING') return 'warning';
  return 'muted';
}

export function HistoryScreen() {
  const [items, setItems] = useState<DonationEntry[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await getDonorProfile();
      setItems(profile.donationHistory ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard>
        <Text style={styles.title}>Donation History</Text>
        <Text style={styles.muted}>Completed donations posted by hospitals.</Text>
      </AppCard>
      {!loading && items.length === 0 ? <AppCard><Text style={styles.muted}>No completed donations recorded yet.</Text></AppCard> : null}
      {items.map((item) => (
        <AppCard key={item.id}>
          <View style={styles.rowBetween}>
            <Text style={styles.ref}>{item.donationNumber ?? 'Donation record'}</Text>
            <StatusBadge label={item.status ?? 'Completed'} tone={statusTone(item.status)} />
          </View>
          <Text style={styles.detail}>Date: {formatDate(item.donatedAt)}</Text>
          <Text style={styles.detail}>Hospital: {item.hospital?.hospitalName ?? item.location ?? 'Hospital not recorded'}</Text>
          <Text style={styles.detail}>Blood Group: {formatBloodGroup(item.bloodGroup)}</Text>
          <Text style={styles.detail}>Units: {item.unitsDonated ?? 1}</Text>
          {item.notes ? <Text style={styles.muted}>{item.notes}</Text> : null}
        </AppCard>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  ref: { color: colors.primaryDark, fontSize: 18, fontWeight: '900', flex: 1 },
  detail: { color: colors.ink, lineHeight: 22 },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
});
