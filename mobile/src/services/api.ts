import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BloodGroup } from '../constants/bloodGroups';
import { authStorageKeys } from '../context/AuthContext';

type ApiEnvelope<T> = { success: boolean; data: T };
const unwrap = <T>(payload: ApiEnvelope<T>): T => payload.data;

const api = axios.create({
  baseURL:
    process.env.EXPO_PUBLIC_MOBILE_API_BASE_URL ??
    process.env.MOBILE_API_BASE_URL ??
    'http://localhost:4000',
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem(authStorageKeys.ACCESS_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export type AuthSession = {
  user: { id: string; email: string; role: 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF' };
  accessToken: string;
  refreshToken: string;
};

export type DonorRegisterPayload = {
  email: string;
  password: string;
  fullName: string;
  bloodGroup: BloodGroup;
  location: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
};

export const authApi = {
  async login(email: string, password: string) {
    const res = await api.post<ApiEnvelope<AuthSession>>('/auth/login', { email, password });
    return unwrap(res.data);
  },
  async registerDonor(payload: DonorRegisterPayload) {
    const res = await api.post<ApiEnvelope<{ email: string }>>('/auth/register', {
      email: payload.email,
      password: payload.password,
      role: 'DONOR',
      donorProfile: {
        fullName: payload.fullName,
        bloodGroup: payload.bloodGroup,
        location: payload.location,
        emergencyContactName: payload.emergencyContactName,
        emergencyContactPhone: payload.emergencyContactPhone,
      },
    });
    return unwrap(res.data);
  },
  async verifyEmail(email: string, code: string) {
    await api.post('/auth/verify-email', { email, code });
  },
  async resendVerification(email: string) {
    await api.post('/auth/resend-verification', { email });
  },
  async logout(refreshToken: string) {
    await api.post('/auth/logout', { refreshToken });
  },
};

export type DonorProfile = {
  id: string;
  fullName: string;
  bloodGroup: BloodGroup;
  location: string;
  eligibilityStatus: boolean;
  availabilityStatus: boolean;
  emergencyContactName: string;
  emergencyContactPhone: string;
  notificationEmailEnabled?: boolean;
  notificationSmsEnabled?: boolean;
  donationHistory: DonationEntry[];
};

export type DonationEntry = {
  id: string;
  donatedAt: string;
  unitsDonated: number;
  location: string;
  notes?: string | null;
};

export type BloodRequest = {
  id: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  type: 'STANDARD' | 'EMERGENCY';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'MATCHING' | 'FULFILLED' | 'CANCELLED';
  location: string;
  requiredBy: string;
  notes?: string | null;
  createdAt: string;
  hospital?: { hospitalName?: string; location?: string };
};

export type Appointment = {
  id: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  notes?: string | null;
  hospital?: { hospitalName?: string; location?: string };
};

export type Notification = {
  id: string;
  title: string;
  body: string;
  delivered: boolean;
  createdAt: string;
};

export const donorApi = {
  async profile() {
    const res = await api.get<ApiEnvelope<DonorProfile>>('/donors/profile');
    return unwrap(res.data);
  },
  async updateProfile(payload: Omit<DonorProfile, 'id' | 'donationHistory'>) {
    const res = await api.post<ApiEnvelope<DonorProfile>>('/donors/profile', payload);
    return unwrap(res.data);
  },
  async emergencyRequests() {
    const res = await api.get<ApiEnvelope<BloodRequest[]>>('/blood-requests');
    return unwrap(res.data).filter((item) => item.type === 'EMERGENCY');
  },
  async appointments() {
    const res = await api.get<ApiEnvelope<Appointment[]>>('/appointments');
    return unwrap(res.data);
  },
  async notifications() {
    const res = await api.get<ApiEnvelope<Notification[]>>('/notifications');
    return unwrap(res.data);
  },
};
