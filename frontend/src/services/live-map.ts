import { io, Socket } from 'socket.io-client';
import api from './api';
import { BloodGroup, PriorityLevel, RequestProgressStatus, RequestStatus } from './hospital-portal';

type ApiEnvelope<T> = { success: boolean; data: T };
const unwrap = <T>(payload: ApiEnvelope<T>): T => payload.data;

export type MapDonor = {
  id: string;
  donorNumber?: string | null;
  fullName?: string | null;
  bloodGroup: BloodGroup;
  location: string;
  areaCommunity?: string | null;
  city?: string | null;
  region?: string | null;
  latitude: number | null;
  longitude: number | null;
  locationSharingEnabled?: boolean;
  lastLocationUpdateAt?: string | null;
  updatedAt: string;
  distanceKm?: number;
  availabilityStatus?: boolean;
  eligibilityStatus?: boolean;
  lastDonationDate?: string | null;
  nextEligibilityDate?: string | null;
  clinicalStatus?: string | null;
  preferredDonationCenter?: {
    id: string;
    hospitalName: string;
    city?: string | null;
    region?: string | null;
  } | null;
  distanceFromCurrentHospitalKm?: number | null;
  totalDonations?: number;
  responseCount?: number;
  acceptedResponseCount?: number;
  operationalStatus?: 'AVAILABLE' | 'COOLDOWN' | 'COOLDOWN_ENDING_SOON' | 'DEFERRED' | 'UNAVAILABLE';
  cooldownDaysRemaining?: number;
};

export type DonorCoveragePayload = {
  totalVisibleDonors: number;
  regions: {
    region: string;
    donorCount: number;
    cityCount: number;
    bloodGroups: Partial<Record<BloodGroup, number>>;
  }[];
  cities: {
    city: string;
    region: string;
    donorCount: number;
    bloodGroups: Partial<Record<BloodGroup, number>>;
  }[];
};

export type MapHospital = {
  id: string;
  hospitalName: string;
  location: string;
  city?: string | null;
  region?: string | null;
  address: string;
  contactPhone: string;
  isApproved?: boolean;
  bloodBankAvailable?: boolean;
  latitude: number | null;
  longitude: number | null;
  inventoryItems?: { bloodGroup: BloodGroup; availableUnits: number }[];
  totalUnits?: number;
  stockStatus?: 'stable' | 'low' | 'critical';
};

export type MapBloodRequest = {
  id: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  priority: PriorityLevel;
  status: RequestStatus;
  trackingStatus: RequestProgressStatus;
  hospitalCenterName?: string | null;
  ward?: string | null;
  location: string;
  emergencyLocation?: string | null;
  city?: string | null;
  region?: string | null;
  locationNotes?: string | null;
  notes?: string | null;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
  requiredBy?: string;
  hospital: { id: string; hospitalName: string };
  donorResponses: { responseStatus: string }[];
};

export type OperationsMapPayload = {
  hospitals: MapHospital[];
  requests: MapBloodRequest[];
  donors: MapDonor[];
  currentHospitalId?: string | null;
};

export async function getOperationsMap() {
  const response = await api.get<ApiEnvelope<OperationsMapPayload>>('/maps/operations');
  return unwrap(response.data);
}

export async function findNearbyDonors(params: {
  bloodGroup: BloodGroup;
  latitude: number;
  longitude: number;
  radiusKm: number;
}) {
  const response = await api.get<ApiEnvelope<MapDonor[]>>('/maps/nearby-donors', { params });
  return unwrap(response.data);
}

export async function updateDonorLiveLocation(payload: {
  latitude?: number;
  longitude?: number;
  areaCommunity?: string;
  city?: string;
  region?: string;
  locationSharingEnabled?: boolean;
  accuracyMeters?: number;
  source?: string;
}) {
  const response = await api.patch<ApiEnvelope<{ message: string; donor: MapDonor }>>('/maps/donor/location', payload);
  return unwrap(response.data);
}

export async function getDonorLiveLocation() {
  const response = await api.get<ApiEnvelope<{ message: string; donor: MapDonor }>>('/maps/donor/location');
  return unwrap(response.data);
}

export async function getDonorCoverage() {
  const response = await api.get<ApiEnvelope<DonorCoveragePayload>>('/maps/donor-coverage');
  return unwrap(response.data);
}

export async function getOperationalDonors(params?: {
  bloodGroup?: BloodGroup;
  latitude?: number;
  longitude?: number;
  radiusKm?: number;
}) {
  const response = await api.get<ApiEnvelope<MapDonor[]>>('/maps/operational-donors', { params });
  return unwrap(response.data);
}

export function createRealtimeSocket(): Socket {
  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';
  const accessToken = localStorage.getItem('accessToken');
  return io(`${baseUrl}/realtime`, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
    auth: accessToken ? { token: `Bearer ${accessToken}` } : undefined,
  });
}
