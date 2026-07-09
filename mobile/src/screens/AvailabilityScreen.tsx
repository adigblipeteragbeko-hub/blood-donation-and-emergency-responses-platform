import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { colors } from '../constants/colors';
import { DonorProfile, getDonorProfile, updateDonorAvailability } from '../services/donor';

export function AvailabilityScreen() {
  const [profile, setProfile] = useState<DonorProfile | null>(null);
  const [available, setAvailableValue] = useState(false);
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const next = await getDonorProfile();
      setProfile(next);
      setAvailableValue(Boolean(next.availabilityStatus));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { void load(); }, [load]));

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      await updateDonorAvailability(available);
      await load();
      setMessage(available ? 'You are available for emergency alerts.' : 'You are marked as not available.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Unable to update availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen refreshing={loading} onRefresh={() => void load()}>
      <AppCard>
        <Text style={styles.title}>Availability</Text>
        <Text style={styles.muted}>When available, hospitals can match you to urgent compatible requests.</Text>
      </AppCard>
      <AppCard style={styles.panel}>
        <View style={styles.rowBetween}>
          <View style={{ flex: 1 }}>
            <Text style={styles.section}>Available for Emergency Alerts</Text>
            <Text style={styles.muted}>Current status: {available ? 'Available' : 'Not available'}</Text>
          </View>
          <Switch value={available} onValueChange={setAvailableValue} trackColor={{ true: '#fecaca', false: '#d1d5db' }} thumbColor={available ? colors.primary : '#f9fafb'} />
        </View>
        <StatusBadge label={profile?.availabilityStatus ? 'Available' : 'Not Available'} tone={profile?.availabilityStatus ? 'success' : 'muted'} />
        <Text style={styles.muted}>Eligibility must be approved and your cooldown must be complete before availability can be used for matching.</Text>
        {message ? <Text style={styles.message}>{message}</Text> : null}
        <AppButton title="Save Availability" loading={saving} onPress={() => void save()} />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  section: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  panel: { gap: 14 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: 12, justifyContent: 'space-between' },
  message: { borderRadius: 12, backgroundColor: colors.warningSoft, color: colors.warning, padding: 10, fontWeight: '800' },
});
