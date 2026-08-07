import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { SmartAvatar } from '../components/SmartAvatar';
import { StatusBadge } from '../components/StatusBadge';
import { formatBloodGroup } from '../constants/bloodGroups';
import { colors } from '../constants/colors';
import { DonorProfile, getDonorProfile } from '../services/donor';
import { donorAddress, donorDisplayName, donorEmail, hasValue } from '../utils/donorIdentity';
import { formatDate } from '../utils/format';

const requiredFields: Array<{ label: string; isComplete: (profile: DonorProfile) => boolean }> = [
  { label: 'Full name', isComplete: (profile) => hasValue(donorDisplayName(profile)) },
  { label: 'Donor ID', isComplete: (profile) => hasValue(profile.donorNumber) },
  { label: 'Blood group', isComplete: (profile) => hasValue(String(profile.bloodGroup ?? '')) },
  { label: 'Phone number', isComplete: (profile) => hasValue(profile.phone) },
  { label: 'Email address', isComplete: (profile) => hasValue(donorEmail(profile)) },
  { label: 'Date of birth', isComplete: (profile) => hasValue(profile.dateOfBirth) },
  { label: 'Address / location', isComplete: (profile) => hasValue(donorAddress(profile)) },
];

export function ProfileScreen() {
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await getDonorProfile());
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const completion = useMemo(() => {
    if (!profile) return { percent: 0, missing: requiredFields.map((field) => field.label) };
    const missing = requiredFields.filter((field) => !field.isComplete(profile)).map((field) => field.label);
    return { percent: Math.round(((requiredFields.length - missing.length) / requiredFields.length) * 100), missing };
  }, [profile]);

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard style={styles.hero}>
        <View style={styles.profileHero}>
          <SmartAvatar name={donorDisplayName(profile)} email={donorEmail(profile)} src={profile?.profileImageUrl} size="lg" />
          <View style={{ flex: 1 }}>
            <Text style={styles.kicker}>Donor Profile</Text>
            <Text style={styles.title}>{donorDisplayName(profile) || 'Loading donor...'}</Text>
            <Text style={styles.muted}>{profile?.donorNumber ?? 'Donor reference pending'}</Text>
          </View>
        </View>
      </AppCard>

      <AppCard>
        <View style={styles.rowBetween}>
          <View>
            <Text style={styles.section}>Profile {completion.percent}% complete</Text>
            <Text style={styles.muted}>{completion.missing.length ? 'Complete missing details in the web portal if needed.' : 'Your key donor details are complete.'}</Text>
          </View>
          <StatusBadge label={completion.percent === 100 ? 'Complete' : 'Review'} tone={completion.percent === 100 ? 'success' : 'warning'} />
        </View>
        {completion.missing.length ? <Text style={styles.missing}>Missing: {completion.missing.join(', ')}</Text> : null}
      </AppCard>

      <AppCard>
        <Text style={styles.section}>Donor Summary</Text>
        <Info label="Blood Group" value={formatBloodGroup(profile?.bloodGroup)} />
        <Info label="Clinical Status" value={profile?.eligibilityStatus ? 'Approved' : 'Pending review'} />
        <Info label="Availability" value={profile?.availabilityStatus ? 'Available' : 'Not available'} />
        <Info label="Date of Birth" value={formatDate(profile?.dateOfBirth)} />
      </AppCard>

      <AppCard>
        <Text style={styles.section}>Contact Details</Text>
        <Info label="Phone" value={profile?.phone ?? 'Not recorded'} />
        <Info label="Email" value={donorEmail(profile) || 'Not recorded'} />
        <Info label="Address" value={donorAddress(profile) || 'Not recorded'} />
        <Info label="Preferred Center" value={profile?.preferredHospital?.hospitalName ?? 'Not selected'} />
      </AppCard>

      <AppCard>
        <Text style={styles.section}>Emergency Contact</Text>
        <Info label="Name" value={profile?.emergencyContactName ?? 'Not recorded'} />
        <Info label="Phone" value={profile?.emergencyContactPhone ?? 'Not recorded'} />
        <Info label="Relationship" value={profile?.emergencyContactRelationship ?? 'Not recorded'} />
      </AppCard>
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <Text style={styles.detail}><Text style={styles.detailLabel}>{label}: </Text>{value}</Text>;
}

const styles = StyleSheet.create({
  hero: { backgroundColor: colors.primarySoft, borderColor: '#fecaca' },
  profileHero: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  kicker: { color: colors.primary, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 1, fontSize: 12 },
  title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  section: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  rowBetween: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 },
  missing: { color: colors.warning, fontWeight: '800', lineHeight: 20 },
  detail: { color: colors.ink, fontSize: 15, lineHeight: 24 },
  detailLabel: { color: colors.muted, fontWeight: '900' },
});
