import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';

type Props = {
  email: string;
  onBackToLogin: () => void;
};
const EXPIRY_SECONDS = 10 * 60;
const PLACEHOLDER_COLOR = '#6b7280';

export function VerifyEmailScreen({ email, onBackToLogin }: Props) {
  const { verifyEmail, resendVerification } = useAuth();
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(EXPIRY_SECONDS);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const timerText = useMemo(() => {
    const mins = Math.floor(secondsLeft / 60)
      .toString()
      .padStart(2, '0');
    const secs = (secondsLeft % 60).toString().padStart(2, '0');
    return `${mins}:${secs}`;
  }, [secondsLeft]);

  const onVerify = async () => {
    setError('');
    setSuccess('');
    setSubmitting(true);
    try {
      await verifyEmail(email, code);
      setSuccess('Email verified. You can now log in.');
      setTimeout(onBackToLogin, 700);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.message ?? 'Verification failed.');
    } finally {
      setSubmitting(false);
    }
  };

  const onResend = async () => {
    setError('');
    setSuccess('');
    setResending(true);
    try {
      await resendVerification(email);
      setSecondsLeft(EXPIRY_SECONDS);
      setSuccess('A new code has been sent to your email.');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Verify Your Email</Text>
      <Text style={styles.subtitle}>Enter the 6-digit code sent to {email}</Text>
      <Text style={styles.timer}>Code expires in {timerText}</Text>

      <TextInput
        style={styles.input}
        placeholderTextColor={PLACEHOLDER_COLOR}
        keyboardType="number-pad"
        maxLength={6}
        placeholder="Enter code"
        value={code}
        onChangeText={setCode}
      />

      {!!error && <Text style={styles.error}>{error}</Text>}
      {!!success && <Text style={styles.success}>{success}</Text>}

      <Pressable style={styles.button} onPress={onVerify} disabled={submitting || code.length < 6}>
        <Text style={styles.buttonText}>{submitting ? 'Verifying...' : 'Verify Email'}</Text>
      </Pressable>

      <Pressable onPress={onResend} disabled={resending}>
        <Text style={styles.link}>{resending ? 'Resending...' : 'Resend Code'}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: 'center', gap: 10, backgroundColor: '#fff' },
  title: { fontSize: 26, fontWeight: '700', color: '#c8102e' },
  subtitle: { color: '#4b5563' },
  timer: { color: '#b91c1c', fontWeight: '600' },
  input: { borderWidth: 1, borderColor: '#d1d5db', borderRadius: 8, padding: 12 },
  button: { backgroundColor: '#c8102e', padding: 14, borderRadius: 8, marginTop: 4 },
  buttonText: { color: '#fff', textAlign: 'center', fontWeight: '700' },
  error: { color: '#b91c1c' },
  success: { color: '#166534' },
  link: { color: '#c8102e', textAlign: 'center', textDecorationLine: 'underline', marginTop: 8 },
});
