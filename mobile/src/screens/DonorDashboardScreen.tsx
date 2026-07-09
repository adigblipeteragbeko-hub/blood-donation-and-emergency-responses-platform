import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { formatBloodGroup } from '../constants/bloodGroups';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { Appointment, getAppointments } from '../services/appointments';
import { getSmartBloodBanks, SmartBloodBankCenter } from '../services/centers';
import { DonorProfile, EligibilityStatus, getDonorEligibilityStatus, getDonorProfile } from '../services/donor';
import { getDonorEmergencyRequests } from '../services/emergency';
import { getNotifications, NotificationItem } from '../services/notifications';
import { DonorTabsParamList } from '../types/navigation';
import { donorDisplayName } from '../utils/donorIdentity';
import { formatDate, formatDateTime, formatDistance } from '../utils/format';

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

function donorFirstName(profile?: DonorProfile | null) {
  return profile?.firstName || donorDisplayName(profile)?.split(' ')[0] || 'Donor';
}

function statusTone(value: boolean | null | undefined): 'success' | 'warning' | 'muted' {
  return value ? 'success' : value === false ? 'muted' : 'warning';
}

export function DonorDashboardScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<DonorTabsParamList>>();
  const { logout } = useAuth();
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [eligibility, setEligibility] = useState<EligibilityStatus | null>(null);
  const [alerts, setAlerts] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [nearestCenter, setNearestCenter] = useState<SmartBloodBankCenter | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setMessage('');
    try {
      const [profileData, eligibilityData, emergencyData, notificationData, appointmentData, centersData] = await Promise.all([
        getDonorProfile(),
        getDonorEligibilityStatus().catch(() => null),
        getDonorEmergencyRequests({ take: 10 }).catch(() => []),
        getNotifications({ take: 5 }).catch(() => []),
        getAppointments({ take: 5 }).catch(() => []),
        getSmartBloodBanks({ radiusKm: 50 }).catch(() => ({ centers: [] })),
      ]);
      setProfile(profileData);
      setEligibility(eligibilityData);
      setAlerts(emergencyData.length);
      setNotifications(notificationData);
      setAppointments(appointmentData);
      setNearestCenter('summary' in centersData ? centersData.summary?.nearestCenter ?? centersData.centers?.[0] ?? null : centersData.centers?.[0] ?? null);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to refresh dashboard.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const completedDonations = profile?.donationHistory?.length ?? 0;
  const nextAppointment = useMemo(() => {
    const now = Date.now();
    return appointments
      .filter((item) => new Date(item.scheduledAt).getTime() >= now && !['COMPLETED', 'CANCELLED', 'MISSED', 'NO_SHOW'].includes(item.status))
      .sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime())[0];
  }, [appointments]);
  const eligibilityApproved = profile?.eligibilityStatus ?? eligibility?.eligibilityStatus ?? null;
  const rewardPoints = profile?.rewardPoints ?? completedDonations * 100;

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Donor Dashboard</Text>
            <Text style={styles.title}>{greeting()}, {donorFirstName(profile)}</Text>
            <Text style={styles.muted}>Thank you for being a lifesaving donor.</Text>
          </View>
          <AppButton title="Logout" variant="outline" onPress={() => void logout()} style={{ minHeight: 42 }} />
        </View>
        <Text style={styles.ref}>{profile?.donorNumber ?? 'Donor reference pending'}</Text>
      </AppCard>

      {message ? <Text style={styles.warning}>{message}</Text> : null}

      <AppCard>
        <Text style={styles.sectionTitle}>Today's Status</Text>
        <View style={styles.statusGrid}>
          <MiniStatus label="Eligibility" value={eligibilityApproved ? 'Approved' : 'Pending'} tone={statusTone(eligibilityApproved)} />
          <MiniStatus label="Availability" value={profile?.availabilityStatus ? 'Available' : 'Not Available'} tone={profile?.availabilityStatus ? 'success' : 'muted'} />
          <MiniStatus label="Blood Group" value={formatBloodGroup(profile?.bloodGroup)} tone="primary" />
          <MiniStatus label="Next Eligible" value={formatDate(profile?.nextEligibilityDate ?? eligibility?.nextEligibilityDate, 'Not available')} tone="muted" />
        </View>
      </AppCard>

      <View style={styles.grid}>
        <AppCard style={styles.stat}><Text style={styles.label}>Lifetime Donations</Text><Text style={styles.value}>{completedDonations}</Text></AppCard>
        <AppCard style={styles.stat}><Text style={styles.label}>Estimated Lives Saved</Text><Text style={styles.value}>{completedDonations * 3}</Text></AppCard>
        <AppCard style={styles.stat}><Text style={styles.label}>Reward Points</Text><Text style={styles.value}>{rewardPoints}</Text></AppCard>
        <AppCard style={styles.stat}><Text style={styles.label}>Emergency Responses</Text><Text style={styles.value}>{profile?.emergencyResponseCount ?? alerts}</Text></AppCard>
      </View>

      <AppCard>
        <Text style={styles.sectionTitle}>Nearest Center</Text>
        {nearestCenter ? (
          <>
            <Text style={styles.rowStrong}>{nearestCenter.name}</Text>
            <Text style={styles.row}>{[nearestCenter.city, nearestCenter.region].filter(Boolean).join(', ') || nearestCenter.address || 'Location not recorded'}</Text>
            <Text style={styles.row}>{formatDistance(nearestCenter.distanceKm)}</Text>
          </>
        ) : <Text style={styles.muted}>Open Centers to find nearby hospitals and blood banks.</Text>}
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Next Appointment</Text>
        {nextAppointment ? (
          <>
            <Text style={styles.rowStrong}>{nextAppointment.appointmentReference ?? 'Appointment scheduled'}</Text>
            <Text style={styles.row}>{nextAppointment.hospital?.hospitalName ?? 'Hospital'} - {nextAppointment.appointmentType ?? 'Blood Donation'}</Text>
            <Text style={styles.row}>{formatDateTime(nextAppointment.scheduledAt)}</Text>
          </>
        ) : <Text style={styles.muted}>No upcoming appointment scheduled yet.</Text>}
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.actions}>
          <AppButton title="Emergency Requests" onPress={() => navigation.navigate('Emergency')} />
          <AppButton title="Notifications" variant="outline" onPress={() => navigation.navigate('Notifications')} />
          <AppButton title="Donor Card" variant="outline" onPress={() => navigation.navigate('DonorCard')} />
          <AppButton title="Location Settings" variant="outline" onPress={() => navigation.navigate('More', { screen: 'Location' })} />
          <AppButton title="Appointments" variant="outline" onPress={() => navigation.navigate('More', { screen: 'Appointments' })} />
          <AppButton title="Centers" variant="outline" onPress={() => navigation.navigate('More', { screen: 'Centers' })} />
        </View>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>Latest Notifications</Text>
        {notifications.length === 0 ? <Text style={styles.muted}>No notifications yet.</Text> : notifications.map((item) => <Text key={item.id} style={styles.row}>{item.title}</Text>)}
      </AppCard>
    </Screen>
  );
}

function MiniStatus({ label, value, tone }: { label: string; value: string; tone: 'success' | 'warning' | 'muted' | 'primary' }) {
  return (
    <View style={styles.miniStatus}>
      <Text style={styles.label}>{label}</Text>
      <StatusBadge label={value} tone={tone} />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primarySoft, borderColor: '#fecaca' },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  kicker: { color: colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1 },
  title: { color: colors.ink, fontSize: 26, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  ref: { color: colors.primaryDark, fontWeight: '900', marginTop: 10 },
  warning: { borderRadius: 12, backgroundColor: colors.warningSoft, color: colors.warning, padding: 10, fontWeight: '800' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  stat: { flexGrow: 1, flexBasis: '46%', minHeight: 105 },
  label: { color: colors.muted, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { color: colors.primaryDark, fontSize: 24, fontWeight: '900' },
  sectionTitle: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  row: { color: colors.ink, fontSize: 15, lineHeight: 22 },
  rowStrong: { color: colors.ink, fontSize: 17, lineHeight: 24, fontWeight: '900' },
  actions: { gap: 10 },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  miniStatus: { flexBasis: '47%', flexGrow: 1, gap: 8, borderWidth: 1, borderColor: colors.border, borderRadius: 16, padding: 12, backgroundColor: '#fff' },
});
