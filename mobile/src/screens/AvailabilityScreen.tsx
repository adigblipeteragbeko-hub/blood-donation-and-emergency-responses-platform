import { useFocusEffect } from '@react-navigation/native';
import { useCallback, useState } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { Screen } from '../components/Screen';
import { StatusBadge } from '../components/StatusBadge';
import { colors } from '../constants/colors';
import { DonorProfile, getDonorProfile, updateDonorAvailability } from '../services/donor';
import { spacing, typography } from '../theme/design';

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
          <Switch value={available} onValueChange={setAvailableValue} trackColor={{ true: colors.primarySoft, false: colors.border }} thumbColor={available ? colors.primary : colors.muted} />
        </View>
        <StatusBadge label={profile?.availabilityStatus ? 'Available' : 'Not Available'} tone={profile?.availabilityStatus ? 'success' : 'muted'} />
        <Text style={styles.muted}>Eligibility must be approved and your cooldown must be complete before availability can be used for matching.</Text>
        <FeedbackMessage message={message} tone={message.includes('Unable') ? 'danger' : 'success'} />
        <AppButton title="Save Availability" icon="save-outline" loading={saving} onPress={() => void save()} />
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.ink, ...typography.screenTitle },
  muted: { color: colors.muted, ...typography.body },
  section: { color: colors.ink, ...typography.sectionTitle },
  panel: { gap: spacing.lg },
  rowBetween: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, justifyContent: 'space-between' },
});
