import { StyleSheet, Text, TextInput, View } from 'react-native';
import { AppButton } from '../components/AppButton';
import { AppCard } from '../components/AppCard';
import { Screen } from '../components/Screen';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { ThemePreference } from '../theme/colors';

export function HealthFormScreen() {
  return (
    <Screen>
      <AppCard>
        <Text style={styles.title}>Health Form</Text>
        <Text style={styles.muted}>The full clinical eligibility form remains web-based so hospitals receive the complete screening record.</Text>
      </AppCard>
      <AppCard>
        <Text style={styles.section}>What to do</Text>
        <Text style={styles.detail}>1. Open the donor web portal.</Text>
        <Text style={styles.detail}>2. Complete or review your Health Eligibility Form.</Text>
        <Text style={styles.detail}>3. Hospital staff will complete screening and approval.</Text>
      </AppCard>
    </Screen>
  );
}

export function SettingsScreen() {
  const { logout } = useAuth();
  const { preference, setPreference } = useTheme();
  return (
    <Screen>
      <AppCard>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.muted}>Mobile settings are intentionally focused on privacy and safe access.</Text>
      </AppCard>
      <AppCard>
        <Text style={styles.section}>Appearance</Text>
        <Text style={styles.detail}>Choose how the donor mobile app looks on this device.</Text>
        <View style={styles.themeGrid}>
          {[
            { value: 'light', label: 'Light', description: 'Use the light platform appearance.' },
            { value: 'dark', label: 'Dark', description: 'Use a darker appearance for low-light environments.' },
            { value: 'system', label: 'System', description: 'Match your device appearance automatically.' },
          ].map((item) => (
            <AppButton
              key={item.value}
              title={`${preference === item.value ? 'Selected: ' : ''}${item.label}`}
              variant={preference === item.value ? 'primary' : 'outline'}
              onPress={() => void setPreference(item.value as ThemePreference)}
            />
          ))}
        </View>
      </AppCard>
      <AppCard>
        <Text style={styles.section}>Account Settings</Text>
        <Text style={styles.detail}>Profile and account edits are managed from the secure web donor portal.</Text>
      </AppCard>
      <AppCard>
        <Text style={styles.section}>Notification Preferences</Text>
        <Text style={styles.detail}>Emergency alerts and appointment updates are enabled for approved donors.</Text>
      </AppCard>
      <AppCard>
        <Text style={styles.section}>Privacy</Text>
        <Text style={styles.detail}>Private is recommended. Your personal details are only visible to authorized hospital staff and administrators.</Text>
        <Text style={styles.detail}>Use Live Location to control secure emergency location sharing.</Text>
      </AppCard>
      <AppButton title="Logout" variant="danger" onPress={() => void logout()} />
    </Screen>
  );
}

export function SupportScreen() {
  return (
    <Screen>
      <AppCard>
        <Text style={styles.title}>Support</Text>
        <Text style={styles.muted}>Help for donors using the mobile companion app.</Text>
      </AppCard>
      <AppCard>
        <Text style={styles.section}>Emergency Contact</Text>
        <Text style={styles.detail}>Phone: +233 544515775</Text>
        <Text style={styles.detail}>Phone: +233 554287342</Text>
        <Text style={styles.detail}>Email: support@bloodresponse.local</Text>
      </AppCard>
      <AppCard>
        <Text style={styles.section}>Ask Support</Text>
        <TextInput style={styles.textArea} multiline placeholder="Describe what you need help with..." textAlignVertical="top" />
        <AppButton title="Send Support Message" variant="outline" onPress={() => undefined} />
      </AppCard>
      <AppCard>
        <Text style={styles.section}>FAQs</Text>
        <Faq question="How do emergency alerts work?" answer="Approved compatible donors receive targeted alerts when hospitals need urgent blood." />
        <Faq question="Can the public see my location?" answer="No. Donor location data is private and only used by authorized staff for emergency coordination." />
        <Faq question="How do I complete eligibility screening?" answer="Submit your Health Form in the web portal, then visit the selected hospital or blood bank for review." />
      </AppCard>
      <AppCard>
        <Text style={styles.section}>Emergency Notice</Text>
        <Text style={styles.detail}>If you are responding to an urgent hospital request, follow the hospital instructions shown in the emergency request details.</Text>
      </AppCard>
    </Screen>
  );
}

function Faq({ question, answer }: { question: string; answer: string }) {
  return (
    <View style={styles.faq}>
      <Text style={styles.faqQuestion}>{question}</Text>
      <Text style={styles.detail}>{answer}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { color: colors.primaryDark, fontSize: 26, fontWeight: '900' },
  muted: { color: colors.muted, lineHeight: 20 },
  section: { color: colors.ink, fontSize: 18, fontWeight: '900' },
  detail: { color: colors.ink, lineHeight: 23 },
  textArea: { minHeight: 110, borderWidth: 1, borderColor: colors.border, borderRadius: 14, padding: 12, backgroundColor: '#fff', color: colors.ink },
  faq: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 10, gap: 4 },
  faqQuestion: { color: colors.primaryDark, fontWeight: '900' },
  themeGrid: { gap: 10, marginTop: 10 },
});
