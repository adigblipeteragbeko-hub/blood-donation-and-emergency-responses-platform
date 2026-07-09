import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { formatBloodGroup } from '../constants/bloodGroups';
import { colors } from '../constants/colors';
import { DonorProfile, getDonorProfile } from '../services/donor';
import { donorAddress, donorDisplayName, donorEmail } from '../utils/donorIdentity';
import { formatDate } from '../utils/format';

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
      {message ? <Text style={styles.error}>{message}</Text> : null}
      <View style={styles.cardShell}>
        <View style={styles.topStrip}>
          <View style={styles.photo}><Text style={styles.photoText}>ID</Text></View>
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{donorDisplayName(profile) || 'Donor Name'}</Text>
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
  title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  error: { borderRadius: 12, backgroundColor: '#fef2f2', color: colors.danger, padding: 10, fontWeight: '800' },
  cardShell: { gap: 16, borderRadius: 28, backgroundColor: colors.primaryDark, padding: 18, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 20, shadowOffset: { width: 0, height: 10 }, elevation: 5 },
  topStrip: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  photo: { width: 72, height: 72, borderRadius: 22, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  photoText: { color: colors.primary, fontSize: 22, fontWeight: '900' },
  name: { color: '#fff', fontSize: 23, fontWeight: '900' },
  ref: { color: '#fecaca', fontWeight: '900', marginTop: 3 },
  qrBox: { width: 58, height: 58, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' },
  qrText: { color: colors.ink, fontWeight: '900' },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  bloodBadge: { borderRadius: 18, backgroundColor: '#fff', paddingHorizontal: 18, paddingVertical: 10 },
  bloodText: { color: colors.primaryDark, fontSize: 22, fontWeight: '900' },
  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, borderRadius: 22, backgroundColor: '#fff', padding: 14 },
  infoItem: { flexBasis: '47%', flexGrow: 1, gap: 3 },
  infoWide: { flexBasis: '100%' },
  infoLabel: { color: colors.muted, fontSize: 11, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.6 },
  infoValue: { color: colors.ink, fontSize: 15, fontWeight: '700', lineHeight: 20 },
  footerPanel: { borderRadius: 18, backgroundColor: '#991b1b', padding: 12 },
  official: { color: '#fff', fontSize: 13, fontWeight: '900', textTransform: 'uppercase', letterSpacing: 0.8 },
  footerText: { color: '#fee2e2', lineHeight: 19, marginTop: 4 },
});
