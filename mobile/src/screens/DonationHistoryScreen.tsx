import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { donorApi, DonationEntry } from '../services/api';

export function DonationHistoryScreen() {
  const [items, setItems] = useState<DonationEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const profile = await donorApi.profile();
      setItems(profile.donationHistory ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Donation History</Text>
      {loading ? <Text style={styles.helper}>Loading donation history...</Text> : null}
      {!loading && items.length === 0 ? <Text style={styles.helper}>No donations recorded yet.</Text> : null}
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{new Date(item.donatedAt).toLocaleDateString()}</Text>
          <Text style={styles.cardText}>Units: {item.unitsDonated}</Text>
          <Text style={styles.cardText}>Location: {item.location}</Text>
          {item.notes ? <Text style={styles.cardText}>Notes: {item.notes}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#c8102e', marginBottom: 2 },
  helper: { color: '#6b7280' },
  card: { borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, gap: 4 },
  cardTitle: { color: '#111827', fontSize: 16, fontWeight: '700' },
  cardText: { color: '#374151' },
});

