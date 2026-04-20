import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { BLOOD_GROUPS, BloodGroup } from '../constants/bloodGroups';
import { donorApi } from '../services/api';

type FormState = {
  fullName: string;
  bloodGroup: BloodGroup;
  location: string;
  eligibilityStatus: boolean;
  availabilityStatus: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
};

const initialState: FormState = {
  fullName: '',
  bloodGroup: 'O_POS',
  location: '',
  eligibilityStatus: true,
  availabilityStatus: true,
  emergencyContactName: '',
  emergencyContactPhone: '',
  notificationEmailEnabled: true,
  notificationSmsEnabled: false,
};

export function ProfileScreen() {
  const [form, setForm] = useState<FormState>(initialState);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const profile = await donorApi.profile();
        setForm({
          fullName: profile.fullName,
          bloodGroup: profile.bloodGroup,
          location: profile.location,
          eligibilityStatus: profile.eligibilityStatus,
          availabilityStatus: profile.availabilityStatus,
          emergencyContactName: profile.emergencyContactName,
          emergencyContactPhone: profile.emergencyContactPhone,
          notificationEmailEnabled: profile.notificationEmailEnabled ?? true,
          notificationSmsEnabled: profile.notificationSmsEnabled ?? false,
        });
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, []);

  const submit = async () => {
    setSaving(true);
    setMessage('');
    try {
      await donorApi.updateProfile(form);
      setMessage('Profile updated successfully.');
    } catch (err: any) {
      setMessage(err?.response?.data?.error?.message ?? 'Failed to update profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loading}>
        <Text>Loading profile...</Text>
      </View>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>My Profile</Text>

      <Text style={styles.label}>Full Name</Text>
      <TextInput style={styles.input} placeholder="Enter your full name" value={form.fullName} onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))} />
      <Text style={styles.label}>Location</Text>
      <TextInput style={styles.input} placeholder="Enter your city or town" value={form.location} onChangeText={(v) => setForm((p) => ({ ...p, location: v }))} />
      <Text style={styles.label}>Emergency Contact Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter emergency contact full name"
        value={form.emergencyContactName}
        onChangeText={(v) => setForm((p) => ({ ...p, emergencyContactName: v }))}
      />
      <Text style={styles.label}>Emergency Contact Phone</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter emergency contact phone number"
        keyboardType="phone-pad"
        value={form.emergencyContactPhone}
        onChangeText={(v) => setForm((p) => ({ ...p, emergencyContactPhone: v }))}
      />

      <Text style={styles.label}>Blood Group</Text>
      <View style={styles.grid}>
        {BLOOD_GROUPS.map((group) => (
          <Pressable
            key={group.value}
            onPress={() => setForm((p) => ({ ...p, bloodGroup: group.value }))}
            style={[styles.pill, form.bloodGroup === group.value && styles.pillActive]}
          >
            <Text style={[styles.pillText, form.bloodGroup === group.value && styles.pillTextActive]}>{group.label}</Text>
          </Pressable>
        ))}
      </View>

      <Toggle label="Available for donation" value={form.availabilityStatus} onChange={(v) => setForm((p) => ({ ...p, availabilityStatus: v }))} />
      <Toggle label="Eligible to donate" value={form.eligibilityStatus} onChange={(v) => setForm((p) => ({ ...p, eligibilityStatus: v }))} />
      <Toggle
        label="Email notifications"
        value={form.notificationEmailEnabled}
        onChange={(v) => setForm((p) => ({ ...p, notificationEmailEnabled: v }))}
      />
      <Toggle
        label="SMS notifications"
        value={form.notificationSmsEnabled}
        onChange={(v) => setForm((p) => ({ ...p, notificationSmsEnabled: v }))}
      />

      <Pressable style={styles.button} onPress={submit} disabled={saving}>
        <Text style={styles.buttonText}>{saving ? 'Saving...' : 'Save Profile'}</Text>
      </Pressable>

      {!!message && <Text style={styles.message}>{message}</Text>}
    </ScrollView>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={styles.toggleLabel}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  container: { padding: 16, gap: 10, backgroundColor: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#c8102e', marginBottom: 2 },
  label: { fontWeight: '600', color: '#374151', marginTop: 4 },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  pillActive: { backgroundColor: '#c8102e', borderColor: '#c8102e' },
  pillText: { color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  toggleRow: {
    borderWidth: 1,
    borderColor: '#e5e7eb',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  toggleLabel: { color: '#374151' },
  button: { backgroundColor: '#c8102e', padding: 14, borderRadius: 8, marginTop: 8 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  message: { color: '#166534' },
});
