import { Ionicons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors } from '../constants/colors';
import { useAuth } from '../hooks/useAuth';
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
  return (
    <MoreStack.Navigator screenOptions={{ headerTitleStyle: { color: colors.primaryDark, fontWeight: '900' }, headerTintColor: colors.primary }}>
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
  return (
    <DonorTabs.Navigator screenOptions={({ route }) => ({ headerTitleStyle: { color: colors.primaryDark, fontWeight: '900' }, headerTintColor: colors.primary, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.muted, tabBarStyle: styles.tabBar, tabBarLabelStyle: styles.tabLabel, tabBarIcon: ({ color, size }) => <Ionicons name={tabIcon(route.name)} color={color} size={size} /> })}>
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
  if (loading) return <View style={styles.loading}><ActivityIndicator color={colors.primary} size="large" /></View>;
  return <NavigationContainer><RootStack.Navigator screenOptions={{ headerShown: false }}>{user ? <RootStack.Screen name="Donor" component={DonorNavigator} /> : <RootStack.Screen name="Auth" component={AuthNavigator} />}</RootStack.Navigator></NavigationContainer>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }, tabBar: { borderTopColor: colors.border, minHeight: 62, paddingBottom: 8, paddingTop: 6 }, tabLabel: { fontSize: 11, fontWeight: '800' } });
