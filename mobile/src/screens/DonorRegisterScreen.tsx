import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { BLOOD_GROUPS, BloodGroup } from '../constants/bloodGroups';
import { useAuth } from '../hooks/useAuth';
import { RootStackParamList } from '../types/navigation';

type Props = NativeStackScreenProps<RootStackParamList, 'DonorRegister'>;

export function DonorRegisterScreen({ navigation }: Props) {
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
    setSubmitting(true);
    try {
      const result = await registerDonor(form);
      navigation.navigate('VerifyEmail', { email: result.email || form.email.trim() });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Registration failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Donor Register</Text>
      <TextInput style={styles.input} placeholder="Full name" value={form.fullName} onChangeText={(v) => setForm((p) => ({ ...p, fullName: v }))} />
      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        value={form.email}
        onChangeText={(v) => setForm((p) => ({ ...p, email: v }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Password (min 8 chars)"
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

      <TextInput style={styles.input} placeholder="Location" value={form.location} onChangeText={(v) => setForm((p) => ({ ...p, location: v }))} />
      <TextInput
        style={styles.input}
        placeholder="Emergency contact name"
        value={form.emergencyContactName}
        onChangeText={(v) => setForm((p) => ({ ...p, emergencyContactName: v }))}
      />
      <TextInput
        style={styles.input}
        placeholder="Emergency contact phone (+233...)"
        value={form.emergencyContactPhone}
        onChangeText={(v) => setForm((p) => ({ ...p, emergencyContactPhone: v }))}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}

      <Pressable style={styles.button} onPress={submit} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Registering...' : 'Register'}</Text>
      </Pressable>
      <Pressable onPress={() => navigation.navigate('DonorLogin')}>
        <Text style={styles.link}>Already registered? Login</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, gap: 10, backgroundColor: '#fff' },
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

