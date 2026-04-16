import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';
import { DonorLoginScreen } from '../screens/DonorLoginScreen';
import { DonorRegisterScreen } from '../screens/DonorRegisterScreen';
import { DashboardScreen } from '../screens/DashboardScreen';
import { EmergencyAlertsScreen } from '../screens/EmergencyAlertsScreen';
import { AppointmentsScreen } from '../screens/AppointmentsScreen';
import { DonationHistoryScreen } from '../screens/DonationHistoryScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function AppNavigator() {
  return (
    <NavigationContainer>
      <Stack.Navigator initialRouteName="DonorLogin">
        <Stack.Screen name="DonorLogin" component={DonorLoginScreen} />
        <Stack.Screen name="DonorRegister" component={DonorRegisterScreen} />
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
        <Stack.Screen name="EmergencyAlerts" component={EmergencyAlertsScreen} />
        <Stack.Screen name="Appointments" component={AppointmentsScreen} />
        <Stack.Screen name="DonationHistory" component={DonationHistoryScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}
