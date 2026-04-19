import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { BLOOD_GROUPS } from '../constants/bloodGroups';
import { BloodRequest, donorApi } from '../services/api';

export function EmergencyAlertsScreen() {
  const [items, setItems] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await donorApi.emergencyRequests();
      setItems(data);
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
      <Text style={styles.title}>Emergency Alerts</Text>
      {loading ? <Text style={styles.helper}>Loading emergency requests...</Text> : null}
      {!loading && items.length === 0 ? <Text style={styles.helper}>No emergency requests at the moment.</Text> : null}
      {items.map((item) => (
        <View key={item.id} style={styles.card}>
          <Text style={styles.cardTitle}>
            {BLOOD_GROUPS.find((group) => group.value === item.bloodGroup)?.label ?? item.bloodGroup} • {item.priority}
          </Text>
          <Text style={styles.cardText}>Units needed: {item.unitsNeeded}</Text>
          <Text style={styles.cardText}>Location: {item.location}</Text>
          <Text style={styles.cardText}>Required by: {new Date(item.requiredBy).toLocaleString()}</Text>
          <Text style={styles.cardText}>Status: {item.status}</Text>
          {item.notes ? <Text style={styles.cardText}>Note: {item.notes}</Text> : null}
        </View>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 10, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#c8102e', marginBottom: 2 },
  helper: { color: '#6b7280' },
  card: { borderWidth: 1, borderColor: '#fecaca', backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, gap: 4 },
  cardTitle: { color: '#991b1b', fontSize: 16, fontWeight: '700' },
  cardText: { color: '#374151' },
});

