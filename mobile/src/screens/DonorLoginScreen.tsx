import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput } from 'react-native';
import { useAuth } from '../hooks/useAuth';

type Props = {
  onGoRegister: () => void;
};

export function DonorLoginScreen({ onGoRegister }: Props) {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const onLogin = async () => {
    setError('');
    setSubmitting(true);
    try {
      await login(email.trim(), password);
    } catch (err: any) {
      const raw = err?.response?.data?.error?.message ?? err?.message ?? 'Login failed.';
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
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
      <Text style={styles.title}>Donor Login</Text>
      <Text style={styles.label}>Email Address</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your email address"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <Text style={styles.label}>Password</Text>
      <TextInput
        style={styles.input}
        placeholder="Enter your password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Pressable style={styles.button} onPress={onLogin} disabled={submitting}>
        <Text style={styles.buttonText}>{submitting ? 'Signing in...' : 'Sign In'}</Text>
      </Pressable>
      <Pressable onPress={onGoRegister}>
        <Text style={styles.link}>New donor? Register here</Text>
      </Pressable>
    </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  keyboardContainer: { flex: 1, backgroundColor: '#fff' },
  container: { flexGrow: 1, padding: 20, paddingTop: 64, justifyContent: 'flex-start', gap: 10, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', color: '#c8102e', marginBottom: 8 },
  label: { fontSize: 14, fontWeight: '600', color: '#374151' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#c8102e', padding: 14, borderRadius: 8, marginTop: 4 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  link: { textAlign: 'center', color: '#c8102e', textDecorationLine: 'underline', marginTop: 8 },
  error: { color: '#b91c1c' },
});
