import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Login: undefined;
};

export type MoreStackParamList = {
  MoreHome: undefined;
  Profile: undefined;
  Eligibility: undefined;
  History: undefined;
  Appointments: undefined;
  Availability: undefined;
  Location: undefined;
  Centers: undefined;
  Rewards: undefined;
  HealthForm: undefined;
  Settings: undefined;
  Support: undefined;
};

export type DonorTabsParamList = {
  Dashboard: undefined;
  Emergency: { requestId?: string } | undefined;
  Notifications: undefined;
  DonorCard: undefined;
  More: NavigatorScreenParams<MoreStackParamList> | undefined;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList> | undefined;
  Donor: NavigatorScreenParams<DonorTabsParamList> | undefined;
};
