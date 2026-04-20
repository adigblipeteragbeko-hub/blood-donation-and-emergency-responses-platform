import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { donorApi, Appointment } from '../services/api';

export function AppointmentsScreen() {
  const [items, setItems] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await donorApi.appointments();
      setItems(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Appointments</Text>
      {loading ? <Text style={styles.helper}>Loading appointments...</Text> : null}
      {!loading && items.length === 0 ? <Text style={styles.helper}>No appointments yet.</Text> : null}

      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>{new Date(item.scheduledAt).toLocaleString()}</Text>
          <Text style={styles.cardText}>Status: {item.status}</Text>
          <Text style={styles.cardText}>Hospital: {item.hospital?.hospitalName ?? '-'}</Text>
          <Text style={styles.cardText}>Location: {item.hospital?.location ?? '-'}</Text>
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
