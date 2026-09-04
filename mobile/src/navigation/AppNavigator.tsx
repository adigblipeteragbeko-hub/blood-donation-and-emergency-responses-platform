import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { AvailabilityScreen } from '../screens/AvailabilityScreen';
import { CentersScreen } from '../screens/CentersScreen';
import { DonorCardScreen } from '../screens/DonorCardScreen';
import { DonorDashboardScreen } from '../screens/DonorDashboardScreen';
import { EligibilityScreen } from '../screens/EligibilityScreen';
import { EmergencyRequestsScreen } from '../screens/EmergencyRequestsScreen';
import { HistoryScreen } from '../screens/HistoryScreen';
import { LocationSettingsScreen } from '../screens/LocationSettingsScreen';
import { LoginScreen } from '../screens/LoginScreen';
import { MoreScreen } from '../screens/MoreScreen';
import { NotificationsScreen } from '../screens/NotificationsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { RewardsScreen } from '../screens/RewardsScreen';
import { HealthFormScreen, SettingsScreen, SupportScreen } from '../screens/UtilityScreens';
import { AuthStackParamList, DonorTabsParamList, MoreStackParamList, RootStackParamList } from '../types/navigation';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const DonorTabs = createBottomTabNavigator<DonorTabsParamList>();
const MoreStack = createNativeStackNavigator<MoreStackParamList>();

function AuthNavigator() {
  return <AuthStack.Navigator screenOptions={{ headerShown: false }}><AuthStack.Screen name="Login" component={LoginScreen} /></AuthStack.Navigator>;
}

function MoreNavigator() {
  const { colors } = useTheme();
  return (
    <MoreStack.Navigator screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTitleStyle: styles.headerTitle, headerTintColor: colors.primaryDark, headerShadowVisible: false, headerBackTitleVisible: false }}>
      <MoreStack.Screen name="MoreHome" component={MoreScreen} options={{ title: 'More' }} />
      <MoreStack.Screen name="Profile" component={ProfileScreen} />
      <MoreStack.Screen name="Eligibility" component={EligibilityScreen} />
      <MoreStack.Screen name="History" component={HistoryScreen} />
      <MoreStack.Screen name="Appointments" component={AppointmentsScreen} />
      <MoreStack.Screen name="Availability" component={AvailabilityScreen} />
      <MoreStack.Screen name="Location" component={LocationSettingsScreen} options={{ title: 'Live Location' }} />
      <MoreStack.Screen name="Centers" component={CentersScreen} />
      <MoreStack.Screen name="Rewards" component={RewardsScreen} />
      <MoreStack.Screen name="HealthForm" component={HealthFormScreen} options={{ title: 'Health Form' }} />
      <MoreStack.Screen name="Settings" component={SettingsScreen} />
      <MoreStack.Screen name="Support" component={SupportScreen} />
    </MoreStack.Navigator>
  );
}

function tabIcon(routeName: keyof DonorTabsParamList) {
  switch (routeName) {
    case 'Dashboard': return 'grid-outline';
    case 'Emergency': return 'warning-outline';
    case 'Notifications': return 'notifications-outline';
    case 'DonorCard': return 'card-outline';
    case 'More': return 'menu-outline';
    default: return 'ellipse-outline';
  }
}

function DonorNavigator() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <DonorTabs.Navigator screenOptions={({ route }) => ({ headerStyle: { backgroundColor: colors.background }, headerTitleStyle: styles.headerTitle, headerTintColor: colors.primaryDark, headerShadowVisible: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.subtle ?? colors.muted, tabBarStyle: [styles.tabBar, { height: 64 + insets.bottom, paddingBottom: Math.max(8, insets.bottom), borderTopColor: colors.border, backgroundColor: colors.card }], tabBarLabelStyle: styles.tabLabel, tabBarIcon: ({ color }) => <Ionicons name={tabIcon(route.name)} color={color} size={22} /> })}>
      <DonorTabs.Screen name="Dashboard" component={DonorDashboardScreen} options={{ title: 'Dashboard' }} />
      <DonorTabs.Screen name="Emergency" component={EmergencyRequestsScreen} options={{ title: 'Emergency' }} />
      <DonorTabs.Screen name="Notifications" component={NotificationsScreen} options={{ title: 'Notifications' }} />
      <DonorTabs.Screen name="DonorCard" component={DonorCardScreen} options={{ title: 'Donor Card', tabBarLabel: 'Card' }} />
      <DonorTabs.Screen name="More" component={MoreNavigator} options={{ headerShown: false, title: 'More' }} />
    </DonorTabs.Navigator>
  );
}

export function AppNavigator() {
  const { user, loading } = useAuth();
  const { colors } = useTheme();
  if (loading) return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} size="large" /></View>;
  return <NavigationContainer><RootStack.Navigator screenOptions={{ headerShown: false }}>{user ? <RootStack.Screen name="Donor" component={DonorNavigator} /> : <RootStack.Screen name="Auth" component={AuthNavigator} />}</RootStack.Navigator></NavigationContainer>;
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '900' as const },
  tabBar: {
    borderTopWidth: 1,
    paddingTop: 8,
  },
  tabLabel: { fontSize: 11, fontWeight: '900', paddingTop: 2 },
});
