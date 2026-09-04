import { useState } from 'react';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { FeedbackMessage } from '../components/FeedbackMessage';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { radius, spacing } from '../theme/design';

export function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo.o.pos@example.test');
  const [password, setPassword] = useState('Demo123!');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setMessage('');
    if (!email.trim() || !password) {
      setMessage('Please enter your email and password.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim(), password);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Invalid email or password. Please check your details and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Screen style={styles.container}>
        <View style={styles.brandBlock}>
          <View style={styles.logo}><Text style={styles.logoText}>+</Text></View>
          <Text style={styles.title}>Donation Desk Mobile</Text>
          <Text style={styles.subtitle}>Donor emergency response companion app</Text>
        </View>

        <AppCard variant="elevated" style={styles.loginCard}>
          <Text style={styles.cardTitle}>Donor Sign In</Text>
          <TextInput
            autoCapitalize="none"
            keyboardType="email-address"
            placeholder="Email address"
            value={email}
            onChangeText={setEmail}
            style={styles.input}
          />
          <TextInput
            placeholder="Password"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            style={styles.input}
          />
          <FeedbackMessage message={message} tone="danger" />
          <AppButton title="Sign In" icon="log-in-outline" loading={loading} onPress={submit} />
          <Text style={styles.helper}>Demo donor: demo.o.pos@example.test / Demo123!</Text>
          <Text style={styles.helper}>Hospital and admin users should continue using the web portal.</Text>
        </AppCard>
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { justifyContent: 'center', paddingVertical: spacing['3xl'] },
  brandBlock: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.sm },
  logo: { width: 72, height: 72, borderRadius: radius.xl, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' },
  logoText: { color: colors.white, fontSize: 42, fontWeight: '900' },
  title: { color: colors.primary, fontSize: 28, lineHeight: 34, fontWeight: '900', textAlign: 'center' },
  subtitle: { color: colors.muted, fontSize: 15, lineHeight: 21, textAlign: 'center' },
  loginCard: { gap: spacing.md },
  cardTitle: { color: colors.ink, fontSize: 20, fontWeight: '900' },
  input: { minHeight: 54, borderWidth: 1, borderColor: colors.borderOnLight, borderRadius: radius.md, paddingHorizontal: spacing.lg, fontSize: 16, backgroundColor: colors.white, color: colors.textOnLight },
  helper: { color: colors.muted, fontSize: 13, lineHeight: 18 },
});
