import { io, Socket } from 'socket.io-client';
import api from './api';
import { BloodGroup, PriorityLevel, RequestProgressStatus, RequestStatus } from './hospital-portal';

type ApiEnvelope<T> = { success: boolean; data: T };
const unwrap = <T>(payload: ApiEnvelope<T>): T => payload.data;

export type MapDonor = {
  id: string;
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
  address: string;
  contactPhone: string;
  latitude: number | null;
  longitude: number | null;
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
  return io(`${baseUrl}/realtime`, {
    transports: ['websocket', 'polling'],
    withCredentials: true,
  });
}
