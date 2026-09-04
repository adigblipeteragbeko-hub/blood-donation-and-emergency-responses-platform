import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { SmartAvatar } from '../components/SmartAvatar';
import { formatBloodGroup } from '../constants/bloodGroups';
import { colors } from '../constants/colors';
import { DonorProfile, getDonorProfile } from '../services/donor';
import { donorAddress, donorDisplayName, donorEmail } from '../utils/donorIdentity';
import { formatDate } from '../utils/format';
import { radius, spacing, typography } from '../theme/design';
import { FeedbackMessage } from '../components/FeedbackMessage';

export function DonorCardScreen() {
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setProfile(await getDonorProfile());
      setMessage('');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to load donor card.');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const address = donorAddress(profile) || 'Not recorded';

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard>
        <Text style={styles.title}>Digital Donor Card</Text>
        <Text style={styles.muted}>Official Donor Identity Summary for hospital screening and blood donation coordination.</Text>
      </AppCard>
      <FeedbackMessage message={message} tone="danger" />
      <View style={styles.cardShell}>
        <View style={styles.topStrip}>
          <View style={styles.photo}><SmartAvatar name={donorDisplayName(profile)} email={donorEmail(profile)} src={profile?.profileImageUrl} size="lg" /></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name} numberOfLines={2}>{donorDisplayName(profile) || 'Donor Name'}</Text>
            <Text style={styles.ref}>{profile?.donorNumber ?? 'DON-YYYY-00000'}</Text>
          </View>
          <View style={styles.qrBox}><Text style={styles.qrText}>QR</Text></View>
        </View>

        <View style={styles.badgeRow}>
          <View style={styles.bloodBadge}><Text style={styles.bloodText}>{formatBloodGroup(profile?.bloodGroup)}</Text></View>
          <StatusBadge label="Valid Donor" tone={profile?.eligibilityStatus ? 'success' : 'warning'} />
        </View>

        <View style={styles.infoGrid}>
          <Info label="Phone" value={profile?.phone ?? 'Not recorded'} />
          <Info label="Email" value={donorEmail(profile) || 'Not recorded'} />
          <Info label="Date of Birth" value={formatDate(profile?.dateOfBirth)} />
          <Info label="Date Issued" value={formatDate(profile?.dateIssued ?? profile?.user?.createdAt)} />
          <Info label="Donor Serial Number" value={profile?.donorNumber ?? 'Not recorded'} wide />
          <Info label="Physical / Postal Address" value={address} wide />
        </View>

        <View style={styles.footerPanel}>
          <Text style={styles.official}>Official Donor Identity Summary</Text>
          <Text style={styles.footerText}>Present this card at registered hospitals or blood banks when requested by authorized staff.</Text>
        </View>
      </View>
    </Screen>
  );
}

function Info({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <View style={[styles.infoItem, wide && styles.infoWide]}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, ...typography.screenTitle },
  muted: { color: colors.muted, ...typography.body },
  cardShell: { gap: spacing.lg, borderRadius: 28, backgroundColor: '#991b1b', padding: spacing.xl, shadowColor: '#000', shadowOpacity: 0.22, shadowRadius: 22, shadowOffset: { width: 0, height: 12 }, elevation: 5 },
  topStrip: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: 72, height: 72, borderRadius: radius.xl, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.white, fontSize: 23, lineHeight: 28, fontWeight: '900' },
  ref: { color: '#fee2e2', fontWeight: '900', marginTop: 3 },
  qrBox: { width: 62, height: 62, borderRadius: radius.lg, backgroundColor: colors.white, alignItems: 'center', justifyContent: 'center' },
  qrText: { color: colors.textOnLight, fontWeight: '900' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md, flexWrap: 'wrap' },
  bloodBadge: { borderRadius: radius.lg, backgroundColor: colors.white, paddingHorizontal: spacing.xl, paddingVertical: spacing.md },
  bloodText: { color: '#991b1b', fontSize: 22, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, borderRadius: radius.xl, backgroundColor: colors.white, padding: spacing.lg },
  infoItem: { flexBasis: '47%', flexGrow: 1, gap: 3, minWidth: 130 },
  infoWide: { flexBasis: '100%' },
  infoLabel: { color: colors.mutedOnLight, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { color: colors.textOnLight, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  footerPanel: { borderRadius: radius.lg, backgroundColor: '#7f1d1d', padding: spacing.md },
  official: { color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  footerText: { color: '#fee2e2', lineHeight: 19, marginTop: 4 },
});
