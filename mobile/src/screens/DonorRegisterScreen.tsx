import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BLOOD_GROUPS, BloodGroup } from '../constants/bloodGroups';
import { useAuth } from '../hooks/useAuth';

type Props = {
  onRegistered: (email: string) => void;
  onBackToLogin: () => void;
};

export function DonorRegisterScreen({ onRegistered, onBackToLogin }: Props) {
  const { registerDonor } = useAuth();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    password: '',
    bloodGroup: 'O_POS' as BloodGroup,
    location: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const submit = async () => {
    setError('');
    if (!form.fullName.trim()) return setError('Full name is required.');
    if (!form.email.trim()) return setError('Email is required.');
    if (!form.password.trim()) return setError('Password is required.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (!form.location.trim()) return setError('Location is required.');
    if (!form.emergencyContactName.trim()) return setError('Emergency contact name is required.');
    if (!form.emergencyContactPhone.trim()) return setError('Emergency contact phone is required.');

    setSubmitting(true);
    try {
      const result = await registerDonor(form);
      onRegistered(result.email || form.email.trim());
    } catch (err: any) {
      const raw = err?.response?.data?.error?.message ?? err?.message ?? 'Registration failed.';
      const message =
        raw === 'Network Error' || raw?.toLowerCase?.().includes('timeout')
          ? 'Cannot reach server. Make sure backend is running on port 4000 and phone/PC are on the same Wi-Fi or hotspot.'
          : raw;
      setError(message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Donor Register</Text>
      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your full name"
        value={form.fullName}
        onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))}
      />
      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email address"
        autoCapitalize="none"
        keyboardType="email-address"
        value={form.email}
        onChangeText={(v) => setForm((p) => ({ ...p, email: v }))}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Create a password (minimum 8 characters)"
        secureTextEntry
        value={form.password}
        onChangeText={(v) => setForm((p) => ({ ...p, password: v }))}
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

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Registering...' : 'Register'}</Text>
      </Pressable>
      <Pressable onPress={onBackToLogin}>
        <Text style={styles.link}>Already registered? Login</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, paddingTop: 48, paddingBottom: 32, gap: 10, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', color: '#c8102e', marginBottom: 8 },
  label: { fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  pill: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  pillActive: { backgroundColor: '#c8102e', borderColor: '#c8102e' },
  pillText: { color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  button: { backgroundColor: '#c8102e', padding: 14, borderRadius: 8, marginTop: 6 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  link: { textAlign: 'center', color: '#c8102e', textDecorationLine: 'underline', marginTop: 8 },
  error: { color: '#b91c1c' },
});
