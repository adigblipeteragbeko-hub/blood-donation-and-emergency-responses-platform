import { BloodGroup } from '../constants/bloodGroups';
import { api, unwrap } from './api';

export type DonorResponseStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'DONATED';

export type DonorResponse = {
  id: string;
  responseStatus: DonorResponseStatus;
  notes?: string | null;
  createdAt?: string;
};

export type BloodRequest = {
  id: string;
  requestReference?: string | null;
  hospitalCenterName?: string | null;
  ward?: string | null;
  bloodGroup: BloodGroup | string;
  unitsNeeded: number;
  type: 'STANDARD' | 'EMERGENCY';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: 'OPEN' | 'MATCHING' | 'FULFILLED' | 'CANCELLED';
  requestSource?: string;
  location?: string | null;
  emergencyLocation?: string | null;
  city?: string | null;
  region?: string | null;
  requiredBy: string;
  notes?: string | null;
  locationNotes?: string | null;
  createdAt: string;
  donorResponses?: DonorResponse[];
  donorMatchContext?: {
    compatible?: boolean;
    eligible?: boolean;
    available?: boolean;
    inCooldown?: boolean;
    distanceKm?: number | null;
  };
  hospital?: { hospitalName?: string | null; location?: string | null; city?: string | null; region?: string | null } | null;
};

export async function getDonorEmergencyRequests(params?: { skip?: number; take?: number }) {
  const response = await api.get('/blood-requests/donor-emergency', { params });
  return unwrap<BloodRequest[]>(response.data);
}

export async function getDonorEmergencyRequestById(id: string) {
  const response = await api.get(`/blood-requests/donor-emergency/${id}`);
  return unwrap<BloodRequest>(response.data);
}

export async function respondToBloodRequest(id: string, payload: { responseStatus: DonorResponseStatus; notes?: string }) {
  const response = await api.post(`/blood-requests/${id}/respond`, payload);
  return unwrap<DonorResponse>(response.data);
}

