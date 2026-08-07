import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { SmartAvatar } from '../components/SmartAvatar';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { DonorProfile, getDonorProfile } from '../services/donor';
import { MoreStackParamList } from '../types/navigation';
import { donorDisplayName, donorEmail } from '../utils/donorIdentity';

type Item = { route: keyof MoreStackParamList; label: string; description: string; icon: keyof typeof Ionicons.glyphMap };

const items: Item[] = [
  { route: 'Profile', label: 'Profile', description: 'Personal, contact, and donor summary.', icon: 'person-outline' },
  { route: 'Eligibility', label: 'Eligibility', description: 'Donation eligibility and cooldown status.', icon: 'checkmark-circle-outline' },
  { route: 'History', label: 'History', description: 'Completed donation records.', icon: 'time-outline' },
  { route: 'Appointments', label: 'Appointments', description: 'View scheduled donation visits.', icon: 'calendar-outline' },
  { route: 'Availability', label: 'Availability', description: 'Set whether you can respond to alerts.', icon: 'toggle-outline' },
  { route: 'Location', label: 'Live Location', description: 'Secure emergency location sharing.', icon: 'location-outline' },
  { route: 'Centers', label: 'Centers', description: 'Find nearby hospitals and blood banks.', icon: 'business-outline' },
  { route: 'Rewards', label: 'Rewards', description: 'Donation badges and milestones.', icon: 'ribbon-outline' },
  { route: 'HealthForm', label: 'Health Form', description: 'Eligibility form status and web handoff.', icon: 'document-text-outline' },
  { route: 'Settings', label: 'Settings', description: 'Privacy and account preferences.', icon: 'settings-outline' },
  { route: 'Support', label: 'Support', description: 'Help and emergency support information.', icon: 'help-circle-outline' },
];

export function MoreScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MoreStackParamList>>();
  const { logout, user } = useAuth();
  const [profile, setProfile] = useState<DonorProfile | null>(null);

  useFocusEffect(useCallback(() => {
    let mounted = true;
    getDonorProfile()
      .then((nextProfile) => {
        if (mounted) setProfile(nextProfile);
      })
      .catch(() => {
        if (mounted) setProfile(null);
      });
    return () => {
      mounted = false;
    };
  }, []));

  const name = donorDisplayName(profile) || user?.email?.split('@')[0] || 'Donor Account';
  const email = donorEmail(profile) || user?.email || 'Email not recorded';

  return (
    <Screen>
      <AppCard style={styles.identityCard}>
        <View style={styles.identityRow}>
          <SmartAvatar name={name} email={email} src={profile?.profileImageUrl} size="lg" />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Current Donor Account</Text>
            <Text style={styles.title}>{name}</Text>
            <Text style={styles.muted}>{email}</Text>
            <Text style={styles.reference}>{profile?.donorNumber ?? 'Donor reference pending'}</Text>
          </View>
        </View>
        <View style={styles.accountActions}>
          <Pressable style={styles.accountButton} onPress={() => void logout()}>
            <Text style={styles.accountButtonText}>Add another account</Text>
          </Pressable>
          <Pressable style={[styles.accountButton, styles.dangerButton]} onPress={() => void logout()}>
            <Text style={[styles.accountButtonText, styles.dangerText]}>Sign out</Text>
          </Pressable>
        </View>
        <Text style={styles.muted}>Mobile account switching uses a safe sign-out and sign-in flow. No other account tokens are stored on this device.</Text>
      </AppCard>

      <AppCard>
        <Text style={styles.sectionTitle}>More Donor Tools</Text>
        <Text style={styles.muted}>Everything from the donor web portal, organized for mobile.</Text>
      </AppCard>

      {items.map((item) => (
        <Pressable key={item.route} style={styles.item} onPress={() => navigation.navigate(item.route)}>
          <View style={styles.iconWrap}><Ionicons name={item.icon} size={22} color={colors.primary} /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.itemTitle}>{item.label}</Text>
            <Text style={styles.muted}>{item.description}</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Pressable>
      ))}

      <Pressable style={[styles.item, styles.logout]} onPress={() => void logout()}>
        <View style={styles.iconWrap}><Ionicons name="log-out-outline" size={22} color={colors.primary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.itemTitle}>Logout</Text>
          <Text style={styles.muted}>End this donor mobile session.</Text>
        </View>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  sectionTitle: { color: colors.primaryDark, fontSize: 22, fontWeight: '900' },
  kicker: { color: colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  muted: { color: colors.muted, lineHeight: 20 },
  identityCard: { borderColor: '#fecaca', backgroundColor: colors.primarySoft },
  identityRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  reference: { color: colors.primaryDark, fontWeight: '900', marginTop: 4 },
  accountActions: { flexDirection: 'row', gap: 10, marginTop: 14, flexWrap: 'wrap' },
  accountButton: { borderWidth: 1, borderColor: colors.border, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 10, backgroundColor: '#fff' },
  accountButtonText: { color: colors.ink, fontWeight: '900' },
  dangerButton: { borderColor: '#fecaca' },
  dangerText: { color: colors.primary },
  item: { flexDirection: 'row', alignItems: 'center', gap: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 18, backgroundColor: '#fff', padding: 14 },
  logout: { borderColor: '#fecaca', backgroundColor: colors.primarySoft },
  iconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  itemTitle: { color: colors.ink, fontSize: 17, fontWeight: '900' },
});
