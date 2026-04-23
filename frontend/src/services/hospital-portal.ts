import api from './api';

export type BloodGroup = 'O_POS' | 'O_NEG' | 'A_POS' | 'A_NEG' | 'B_POS' | 'B_NEG' | 'AB_POS' | 'AB_NEG';
export type RequestStatus = 'OPEN' | 'MATCHING' | 'FULFILLED' | 'CANCELLED';
export type RequestProgressStatus = 'PENDING' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type AppointmentStatus = 'SCHEDULED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
export type DonorResponseStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'DONATED';
export type InventoryChangeType = 'ADDED' | 'USED' | 'EXPIRED' | 'ADJUSTED';

export type InventoryItem = {
  id: string;
  bloodGroup: BloodGroup;
  availableUnits: number;
  lastUpdated: string;
  hospital?: { hospitalName: string; location: string };
  updatedBy?: { email: string } | null;
};

export type InventoryLogItem = {
  id: string;
  changeType: InventoryChangeType;
  unitsChanged: number;
  previousUnits: number;
  newUnits: number;
  reason?: string | null;
  createdAt: string;
  changedBy?: { email: string; role: string } | null;
  inventory: {
    id: string;
    bloodGroup: BloodGroup;
    hospital?: { hospitalName: string; location: string };
  };
};

export type BloodRequestUpdateItem = {
  id: string;
  oldStatus?: RequestProgressStatus | null;
  newStatus: RequestProgressStatus;
  comment?: string | null;
  createdAt: string;
  updatedBy?: { email: string; role: string } | null;
};

export type DonorResponseItem = {
  id: string;
  responseStatus: DonorResponseStatus;
  responseTime?: string | null;
  notes?: string | null;
  createdAt: string;
  donor: {
    id: string;
    fullName: string;
    bloodGroup: BloodGroup;
    location: string;
    user: { email: string };
  };
};

export type BloodRequestItem = {
  id: string;
  patientName?: string | null;
  patientCode?: string | null;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  type: 'STANDARD' | 'EMERGENCY';
  priority: PriorityLevel;
  status: RequestStatus;
  trackingStatus: RequestProgressStatus;
  location: string;
  requiredBy: string;
  createdAt: string;
  notes?: string | null;
  updates?: BloodRequestUpdateItem[];
  donorResponses?: DonorResponseItem[];
  hospital?: { hospitalName: string; location: string };
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

export async function patchInventoryItem(id: string, payload: { availableUnits: number; reason?: string }) {
  const response = await api.patch<ApiEnvelope<InventoryItem>>(`/inventory/${id}`, payload);
  return unwrap(response.data);
}

export async function getInventoryLogs() {
  const response = await api.get<ApiEnvelope<InventoryLogItem[]>>('/inventory/logs');
  return unwrap(response.data);
}

export async function createInventoryLog(
  id: string,
  payload: { changeType: InventoryChangeType; unitsChanged: number; reason?: string },
) {
  const response = await api.post<ApiEnvelope<{ updatedInventory: InventoryItem; log: InventoryLogItem }>>(
    `/inventory/${id}/logs`,
    payload,
  );
  return unwrap(response.data);
}

export async function createHospitalRequest(payload: {
  patientName?: string;
  patientCode?: string;
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

export async function getAllBloodRequests() {
  const response = await api.get<ApiEnvelope<BloodRequestItem[]>>('/blood-requests');
  return unwrap(response.data);
}

export async function getBloodRequestById(id: string) {
  const response = await api.get<ApiEnvelope<BloodRequestItem>>(`/blood-requests/${id}`);
  return unwrap(response.data);
}

export async function updateHospitalRequestStatus(id: string, status: RequestStatus, comment?: string) {
  const response = await api.patch<ApiEnvelope<BloodRequestItem>>(`/blood-requests/${id}/status`, { status, comment });
  return unwrap(response.data);
}

export async function getBloodRequestUpdates(id: string) {
  const response = await api.get<ApiEnvelope<BloodRequestUpdateItem[]>>(`/blood-requests/${id}/updates`);
  return unwrap(response.data);
}

export async function createBloodRequestUpdate(
  id: string,
  payload: { newStatus: RequestProgressStatus; comment?: string },
) {
  const response = await api.post<ApiEnvelope<{ request: BloodRequestItem; update: BloodRequestUpdateItem }>>(
    `/blood-requests/${id}/updates`,
    payload,
  );
  return unwrap(response.data);
}

export async function getBloodRequestDonorResponses(id: string) {
  const response = await api.get<ApiEnvelope<DonorResponseItem[]>>(`/blood-requests/${id}/donor-responses`);
  return unwrap(response.data);
}

export async function respondToBloodRequest(
  id: string,
  payload: { responseStatus: DonorResponseStatus; notes?: string },
) {
  const response = await api.post<ApiEnvelope<DonorResponseItem>>(`/blood-requests/${id}/respond`, payload);
  return unwrap(response.data);
}

export async function updateDonorResponse(
  id: string,
  payload: { responseStatus?: DonorResponseStatus; notes?: string },
) {
  const response = await api.patch<ApiEnvelope<DonorResponseItem>>(`/donor-responses/${id}`, payload);
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

