import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../hooks/useAuth';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { DonationHistoryScreen } from '../screens/DonationHistoryScreen';
import { DonorLoginScreen } from '../screens/DonorLoginScreen';
import { DonorRegisterScreen } from '../screens/DonorRegisterScreen';
import { EmergencyAlertsScreen } from '../screens/EmergencyAlertsScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { VerifyEmailScreen } from '../screens/VerifyEmailScreen';
import { RootStackParamList } from '../types/navigation';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator size="large" color="#c8102e" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      {user ? (
        <Stack.Navigator initialRouteName="Dashboard">
          <Stack.Screen name="Dashboard" component={DashboardScreen} options={{ title: 'Donor Dashboard' }} />
          <Stack.Screen name="EmergencyAlerts" component={EmergencyAlertsScreen} options={{ title: 'Emergency Alerts' }} />
          <Stack.Screen name="Appointments" component={AppointmentsScreen} options={{ title: 'Appointments' }} />
          <Stack.Screen name="DonationHistory" component={DonationHistoryScreen} options={{ title: 'Donation History' }} />
          <Stack.Screen name="Profile" component={ProfileScreen} options={{ title: 'My Profile' }} />
        </Stack.Navigator>
      ) : (
        <Stack.Navigator initialRouteName="DonorLogin">
          <Stack.Screen name="DonorLogin" component={DonorLoginScreen} options={{ title: 'Donor Login' }} />
          <Stack.Screen name="DonorRegister" component={DonorRegisterScreen} options={{ title: 'Donor Register' }} />
          <Stack.Screen name="VerifyEmail" component={VerifyEmailScreen} options={{ title: 'Verify Email' }} />
        </Stack.Navigator>
      )}
    </NavigationContainer>
  );
}

