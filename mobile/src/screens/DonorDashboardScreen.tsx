import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { EmptyState } from '../components/EmptyState';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { Screen } from '../components/Screen';
import { SectionHeader } from '../components/SectionHeader';
import { StatusBadge } from '../components/StatusBadge';
import { SmartAvatar } from '../components/SmartAvatar';
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
import { radius, spacing, typography } from '../theme/design';

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
      <AppCard variant="soft" style={styles.hero}>
        <View style={styles.heroTop}>
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Donor Dashboard</Text>
            <Text style={styles.title}>{greeting()}, {donorFirstName(profile)}</Text>
            <Text style={styles.muted}>Thank you for being a lifesaving donor.</Text>
            <Text style={styles.ref}>{profile?.donorNumber ?? 'Donor reference pending'}</Text>
          </View>
          <View style={styles.heroActions}>
            <SmartAvatar name={donorDisplayName(profile)} email={profile?.email ?? profile?.user?.email} src={profile?.profileImageUrl} size="md" />
            <AppButton title="Logout" variant="outline" onPress={() => void logout()} style={styles.logoutButton} />
          </View>
        </View>
      </AppCard>

      <FeedbackMessage message={message} />
      {eligibility && eligibility.canSetAvailable === false ? (
        <FeedbackMessage message={eligibility.reason ?? 'Complete your Health Eligibility Form and hospital review before becoming available for emergency matching.'} />
      ) : null}

      <AppCard>
        <SectionHeader title="Today's Status" />
        <View style={styles.statusGrid}>
          <MiniStatus label="Eligibility" value={eligibilityApproved ? 'Approved' : 'Pending'} tone={statusTone(eligibilityApproved)} />
          <MiniStatus label="Availability" value={profile?.availabilityStatus ? 'Available' : 'Not Available'} tone={profile?.availabilityStatus ? 'success' : 'muted'} />
          <MiniStatus label="Blood Group" value={formatBloodGroup(profile?.bloodGroup)} tone="primary" />
          <MiniStatus label="Next Eligible" value={formatDate(profile?.nextEligibilityDate ?? eligibility?.nextEligibilityDate, 'Not available')} tone="muted" />
        </View>
      </AppCard>

      <View style={styles.grid}>
        <StatCard label="Lifetime Donations" value={completedDonations} icon="water-outline" />
        <StatCard label="Estimated Lives Saved" value={completedDonations * 3} icon="heart-outline" />
        <StatCard label="Reward Points" value={rewardPoints} icon="ribbon-outline" />
        <StatCard label="Emergency Responses" value={profile?.emergencyResponseCount ?? alerts} icon="pulse-outline" />
      </View>

      <AppCard>
        <SectionHeader title="Nearest Center" />
        {nearestCenter ? (
          <>
            <Text style={styles.rowStrong}>{nearestCenter.name}</Text>
            <Text style={styles.row}>{[nearestCenter.city, nearestCenter.region].filter(Boolean).join(', ') || nearestCenter.address || 'Location not recorded'}</Text>
            <Text style={styles.row}>{formatDistance(nearestCenter.distanceKm)}</Text>
          </>
        ) : <Text style={styles.muted}>Open Centers to find nearby hospitals and blood banks.</Text>}
      </AppCard>

      <AppCard>
        <SectionHeader title="Next Appointment" />
        {nextAppointment ? (
          <>
            <Text style={styles.rowStrong}>{nextAppointment.appointmentReference ?? 'Appointment scheduled'}</Text>
            <Text style={styles.row}>{nextAppointment.hospital?.hospitalName ?? 'Hospital'} - {nextAppointment.appointmentType ?? 'Blood Donation'}</Text>
            <Text style={styles.row}>{formatDateTime(nextAppointment.scheduledAt)}</Text>
          </>
        ) : <EmptyState icon="calendar-outline" title="No Upcoming Appointment" message="No upcoming appointment scheduled yet." />}
      </AppCard>

      <AppCard>
        <SectionHeader title="Quick Actions" />
        <View style={styles.actions}>
          <AppButton title="Emergency Requests" icon="warning-outline" onPress={() => navigation.navigate('Emergency')} />
          <View style={styles.actionGrid}>
            <QuickAction title="Notifications" icon="notifications-outline" onPress={() => navigation.navigate('Notifications')} />
            <QuickAction title="Donor Card" icon="card-outline" onPress={() => navigation.navigate('DonorCard')} />
            <QuickAction title="Location" icon="location-outline" onPress={() => navigation.navigate('More', { screen: 'Location' })} />
            <QuickAction title="Appointments" icon="calendar-outline" onPress={() => navigation.navigate('More', { screen: 'Appointments' })} />
            <QuickAction title="Centers" icon="business-outline" onPress={() => navigation.navigate('More', { screen: 'Centers' })} />
          </View>
        </View>
      </AppCard>

      <AppCard>
        <SectionHeader title="Latest Notifications" />
        {notifications.length === 0 ? (
          <EmptyState icon="notifications-outline" title="No Notifications Yet" message="Emergency alerts and appointment updates will appear here." />
        ) : notifications.map((item) => (
          <View key={item.id} style={styles.notificationPreview}>
            <Text style={styles.rowStrong}>{item.title}</Text>
            <Text style={styles.muted}>{formatDateTime(item.createdAt)}</Text>
          </View>
        ))}
      </AppCard>
    </Screen>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <AppCard variant="elevated" style={styles.stat}>
      <Ionicons name={icon} size={20} color={colors.primaryDark} />
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </AppCard>
  );
}

function QuickAction({ title, icon, onPress }: { title: string; icon: keyof typeof Ionicons.glyphMap; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [styles.quickAction, pressed && styles.pressed]}>
      <Ionicons name={icon} size={21} color={colors.primaryDark} />
      <Text style={styles.quickActionText}>{title}</Text>
    </Pressable>
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
  hero: { padding: spacing.xl },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  heroActions: { alignItems: 'center', gap: spacing.sm },
  logoutButton: { minHeight: 40, paddingHorizontal: spacing.md },
  kicker: { color: colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 12 },
  title: { color: colors.ink, ...typography.screenTitle },
  muted: { color: colors.muted, ...typography.body },
  ref: { alignSelf: 'flex-start', color: colors.primaryDark, fontWeight: '900', marginTop: spacing.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  stat: { flexGrow: 1, flexBasis: '46%', minHeight: 118 },
  label: { color: colors.muted, fontWeight: '800', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 },
  value: { color: colors.primaryDark, ...typography.stat },
  row: { color: colors.ink, ...typography.body },
  rowStrong: { color: colors.ink, ...typography.cardTitle },
  actions: { gap: spacing.md },
  actionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  quickAction: { flexBasis: '47%', flexGrow: 1, minHeight: 78, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, backgroundColor: colors.elevated, padding: spacing.md, justifyContent: 'center', gap: spacing.sm },
  quickActionText: { color: colors.ink, fontWeight: '900', fontSize: 14 },
  pressed: { opacity: 0.82 },
  notificationPreview: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: spacing.md, gap: spacing.xs },
  statusGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  miniStatus: { flexBasis: '47%', flexGrow: 1, minHeight: 86, gap: spacing.sm, borderWidth: 1, borderColor: colors.border, borderRadius: radius.lg, padding: spacing.md, backgroundColor: colors.elevated },
});
