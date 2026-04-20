import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { BLOOD_GROUPS } from '../constants/bloodGroups';
import { useAuth } from '../hooks/useAuth';
import { donorApi } from '../services/api';

type Props = {
  onNavigate: (route: 'EmergencyAlerts' | 'Appointments' | 'DonationHistory' | 'Profile' | 'Dashboard') => void;
};

export function DashboardScreen({ onNavigate }: Props) {
  const { user, logout } = useAuth();
  const [loading, setLoading] = useState(true);
  const [bloodGroup, setBloodGroup] = useState('-');
  const [donations, setDonations] = useState(0);
  const [openAlerts, setOpenAlerts] = useState(0);
  const [appointments, setAppointments] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [profile, emergency, appointmentList] = await Promise.all([
        donorApi.profile(),
        donorApi.emergencyRequests(),
        donorApi.appointments(),
      ]);
      setBloodGroup(BLOOD_GROUPS.find((group) => group.value === profile.bloodGroup)?.label ?? profile.bloodGroup);
      setDonations(profile.donationHistory?.length ?? 0);
      setOpenAlerts(emergency.filter((item) => item.status === 'OPEN' || item.status === 'MATCHING').length);
      setAppointments(appointmentList.length);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Donor Dashboard</Text>
        <Text style={styles.sub}>Signed in as {user?.email}</Text>
      </View>

      <View style={styles.grid}>
        <Card label="Blood Group" value={loading ? '...' : bloodGroup} />
        <Card label="Total Donations" value={loading ? '...' : String(donations)} />
        <Card label="Emergency Alerts" value={loading ? '...' : String(openAlerts)} />
        <Card label="Appointments" value={loading ? '...' : String(appointments)} />
      </View>

      <View style={styles.actions}>
        <NavButton label="Emergency Alerts" onPress={() => onNavigate('EmergencyAlerts')} />
        <NavButton label="Appointments" onPress={() => onNavigate('Appointments')} />
        <NavButton label="Donation History" onPress={() => onNavigate('DonationHistory')} />
        <NavButton label="Profile" onPress={() => onNavigate('Profile')} />
      </View>

      <Pressable style={styles.logoutButton} onPress={() => void logout()}>
        <Text style={styles.logoutText}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardLabel}>{label}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

function NavButton({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable style={styles.navButton} onPress={onPress}>
      <Text style={styles.navButtonText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { padding: 16, gap: 14, backgroundColor: '#fff' },
  header: { backgroundColor: '#fef2f2', borderRadius: 10, padding: 12, borderWidth: 1, borderColor: '#fecaca' },
  title: { fontSize: 24, fontWeight: '700', color: '#c8102e' },
  sub: { color: '#4b5563', marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '48%', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 12, backgroundColor: '#fff' },
  cardLabel: { color: '#6b7280', fontSize: 12 },
  cardValue: { color: '#c8102e', fontSize: 22, fontWeight: '700', marginTop: 4 },
  actions: { gap: 8, marginTop: 8 },
  navButton: { backgroundColor: '#c8102e', borderRadius: 8, padding: 12 },
  navButtonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  logoutButton: { borderWidth: 1, borderColor: '#c8102e', borderRadius: 8, padding: 12, marginTop: 8 },
  logoutText: { color: '#c8102e', textAlign: 'center', fontWeight: '700' },
});
