import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BLOOD_GROUPS, BloodGroup } from '../constants/bloodGroups';
import { COUNTRY_PHONE_OPTIONS, DEFAULT_COUNTRY_PHONE, normalizeNationalNumber, toE164 } from '../constants/countryPhone';
import { useAuth } from '../hooks/useAuth';

type Props = {
  onRegistered: (email: string) => void;
  onBackToLogin: () => void;
};
const PLACEHOLDER_COLOR = '#6b7280';

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
  const [countryId, setCountryId] = useState(DEFAULT_COUNTRY_PHONE.id);
  const [phoneLocal, setPhoneLocal] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const selectedCountry = COUNTRY_PHONE_OPTIONS.find((item) => item.id === countryId) ?? DEFAULT_COUNTRY_PHONE;

  const submit = async () => {
    setError('');
    if (!form.fullName.trim()) return setError('Full name is required.');
    if (!form.email.trim()) return setError('Email is required.');
    if (!form.password.trim()) return setError('Password is required.');
    if (form.password.length < 8) return setError('Password must be at least 8 characters.');
    if (!form.location.trim()) return setError('Location is required.');
    if (!form.emergencyContactName.trim()) return setError('Emergency contact name is required.');
    if (!phoneLocal.trim()) return setError('Emergency contact phone is required.');
    const normalizedPhone = normalizeNationalNumber(phoneLocal, selectedCountry);
    if (normalizedPhone.length !== selectedCountry.nationalLength) {
      return setError(
        `Phone for ${selectedCountry.name} must be ${selectedCountry.nationalLength} digits (or ${
          selectedCountry.nationalLength + 1
        } digits if you start with 0).`,
      );
    }

    setSubmitting(true);
    try {
      const payload = {
        ...form,
        emergencyContactPhone: toE164(selectedCountry, normalizedPhone),
      };
      const result = await registerDonor(payload);
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
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.keyboardContainer}>
    <ScrollView
      contentContainerStyle={styles.container}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.title}>Donor Register</Text>
      <Text style={styles.label}>Full Name</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={PLACEHOLDER_COLOR}
        placeholder="Enter your full name"
        value={form.fullName}
        onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))}
      />
      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={PLACEHOLDER_COLOR}
        placeholder="Enter your email address"
        autoCapitalize="none"
        keyboardType="email-address"
        value={form.email}
        onChangeText={(v) => setForm((p) => ({ ...p, email: v }))}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={PLACEHOLDER_COLOR}
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
      <TextInput style={styles.input} placeholderTextColor={PLACEHOLDER_COLOR} placeholder="Enter your city or town" value={form.location} onChangeText={(v) => setForm((p) => ({ ...p, location: v }))} />
      <Text style={styles.label}>Emergency Contact Name</Text>
      <TextInput
        style={styles.input}
        placeholderTextColor={PLACEHOLDER_COLOR}
        placeholder="Enter emergency contact full name"
        value={form.emergencyContactName}
        onChangeText={(v) => setForm((p) => ({ ...p, emergencyContactName: v }))}
      />
      <Text style={styles.label}>Emergency Contact Phone</Text>
      <View style={styles.countryList}>
        {COUNTRY_PHONE_OPTIONS.map((country) => {
          const active = country.id === selectedCountry.id;
          return (
            <Pressable
              key={country.id}
              onPress={() => setCountryId(country.id)}
              style={[styles.countryChip, active && styles.countryChipActive]}
            >
              <Text style={[styles.countryChipText, active && styles.countryChipTextActive]}>
                {country.id} +{country.dialCode}
              </Text>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        style={styles.input}
        placeholderTextColor={PLACEHOLDER_COLOR}
        placeholder={`${selectedCountry.name}: ${
          selectedCountry.nationalLength + 1
        } digits if starting with 0, else ${selectedCountry.nationalLength}`}
        keyboardType="phone-pad"
        value={phoneLocal}
        onChangeText={setPhoneLocal}
      />
      <Text style={styles.helperText}>
        Saved as: +{selectedCountry.dialCode}
        {normalizeNationalNumber(phoneLocal, selectedCountry)}
      </Text>

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Registering...' : 'Register'}</Text>
      </Pressable>
      <Pressable onPress={onBackToLogin}>
        <Text style={styles.link}>Already registered? Login</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1, backgroundColor: '#fff' },
  container: { padding: 20, paddingTop: 48, paddingBottom: 32, gap: 10, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', color: '#c8102e', marginBottom: 8 },
  label: { fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  countryList: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 2 },
  countryChip: {
    borderWidth: 1,
    borderColor: '#cbd5e1',
    borderRadius: 999,
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  countryChipActive: { backgroundColor: '#c8102e', borderColor: '#c8102e' },
  countryChipText: { color: '#374151', fontWeight: '600' },
  countryChipTextActive: { color: '#fff' },
  helperText: { color: '#6b7280', marginTop: -2 },
  pill: { borderWidth: 1, borderColor: '#cbd5e1', borderRadius: 999, paddingVertical: 6, paddingHorizontal: 10 },
  pillActive: { backgroundColor: '#c8102e', borderColor: '#c8102e' },
  pillText: { color: '#374151', fontWeight: '600' },
  pillTextActive: { color: '#fff' },
  button: { backgroundColor: '#c8102e', padding: 14, borderRadius: 8, marginTop: 6 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  link: { textAlign: 'center', color: '#c8102e', textDecorationLine: 'underline', marginTop: 8 },
  error: { color: '#b91c1c' },
});
