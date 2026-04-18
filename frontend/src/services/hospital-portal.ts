import api from './api';

export type BloodGroup = 'O_POS' | 'O_NEG' | 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG';
export type RequestStatus = 'OPEN' | 'MATCHING' | 'FULFILLED' | 'CANCELLED';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';

export type InventoryItem = {
  id: string;
  bloodGroup: BloodGroup;
  availableUnits: number;
  lastUpdated: string;
};

export type BloodRequestItem = {
  id: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  type: 'STANDARD' | 'EMERGENCY';
  priority: PriorityLevel;
  status: RequestStatus;
  location: string;
  requiredBy: string;
  createdAt: string;
  notes?: string | null;
};

export type DonorMatch = {
  id: string;
  fullName: string;
  bloodGroup: BloodGroup;
  location: string;
  emergencyContactPhone: string;
};

export type AppointmentItem = {
  id: string;
  scheduledAt: string;
  status: AppointmentStatus;
  notes?: string | null;
  donor?: { id: string; fullName: string; bloodGroup: BloodGroup; location: string };
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  delivered: boolean;
  createdAt: string;
};

export type HospitalProfile = {
  id: string;
  hospitalName: string;
  registrationCode: string;
  address: string;
  location: string;
  contactName: string;
  contactPhone: string;
};

type ApiEnvelope<T> = { success: boolean; data: T };

const unwrap = <T>(payload: ApiEnvelope<T>): T => payload.data;

export async function getHospitalProfile() {
  const response = await api.get<ApiEnvelope<HospitalProfile>>('/hospitals/profile');
  return unwrap(response.data);
}

export async function upsertHospitalProfile(payload: Omit<HospitalProfile, 'id'>) {
  const response = await api.post<ApiEnvelope<HospitalProfile>>('/hospitals/profile', payload);
  return unwrap(response.data);
}

export async function getHospitalInventory() {
  const response = await api.get<ApiEnvelope<InventoryItem[]>>('/inventory');
  return unwrap(response.data);
}

export async function upsertHospitalInventory(payload: { bloodGroup: BloodGroup; availableUnits: number }) {
  const response = await api.post<ApiEnvelope<InventoryItem>>('/inventory', payload);
  return unwrap(response.data);
}

export async function createHospitalRequest(payload: {
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  type: 'STANDARD' | 'EMERGENCY';
  priority: PriorityLevel;
  location: string;
  requiredBy: string;
  notes?: string;
}) {
  const response = await api.post<ApiEnvelope<BloodRequestItem>>('/blood-requests', payload);
  return unwrap(response.data);
}

export async function getHospitalRequests() {
  const response = await api.get<ApiEnvelope<BloodRequestItem[]>>('/blood-requests/mine');
  return unwrap(response.data);
}

export async function updateHospitalRequestStatus(id: string, status: RequestStatus) {
  const response = await api.patch<ApiEnvelope<BloodRequestItem>>(`/blood-requests/${id}/status`, { status });
  return unwrap(response.data);
}

export async function searchHospitalDonors(payload: { bloodGroup?: BloodGroup; location?: string }) {
  const response = await api.get<ApiEnvelope<DonorMatch[]>>('/hospitals/donor-search', { params: payload });
  return unwrap(response.data);
}

export async function getHospitalAppointments() {
  const response = await api.get<ApiEnvelope<AppointmentItem[]>>('/appointments');
  return unwrap(response.data);
}

export async function createHospitalAppointment(payload: { donorId: string; scheduledAt: string; notes?: string }) {
  const response = await api.post<ApiEnvelope<AppointmentItem>>('/appointments/hospital', payload);
  return unwrap(response.data);
}

export async function updateHospitalAppointmentStatus(id: string, status: AppointmentStatus) {
  const response = await api.patch<ApiEnvelope<AppointmentItem>>(`/appointments/${id}/status`, { status });
  return unwrap(response.data);
}

export async function getHospitalNotifications() {
  const response = await api.get<ApiEnvelope<NotificationItem[]>>('/notifications');
  return unwrap(response.data);
}

export async function markNotificationDelivered(notificationId: string, delivered: boolean) {
  const response = await api.patch<ApiEnvelope<NotificationItem>>('/notifications/delivery', { notificationId, delivered });
  return unwrap(response.data);
}

export async function getHospitalReportsSummary(from?: string, to?: string) {
  const response = await api.get<ApiEnvelope<any>>('/reports/summary', { params: { from, to } });
  return unwrap(response.data);
}
