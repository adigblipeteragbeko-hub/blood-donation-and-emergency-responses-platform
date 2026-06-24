import api from './api';

export type BloodGroup =
  | 'UNKNOWN'
  | 'O_POS'
  | 'O_NEG'
  | 'A_POS'
  | 'A_NEG'
  | 'B_POS'
  | 'B_NEG'
  | 'AB_POS'
  | 'AB_NEG';
export type RequestStatus = 'OPEN' | 'MATCHING' | 'FULFILLED' | 'CANCELLED';
export type RequestProgressStatus = 'PENDING' | 'MATCHED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type RequestSource = 'DONORS_ONLY' | 'HOSPITALS_ONLY' | 'DONORS_AND_HOSPITALS';
export type AppointmentStatus = 'SCHEDULED' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'MISSED' | 'NO_SHOW';
export type AppointmentType = 'BLOOD_DONATION' | 'ELIGIBILITY_SCREENING' | 'FOLLOW_UP' | 'EMERGENCY_DONATION';
export type DonorResponseStatus = 'PENDING' | 'ACCEPTED' | 'DECLINED' | 'DONATED';
export type InventoryChangeType = 'ADDED' | 'USED' | 'EXPIRED' | 'ADJUSTED';
export type HospitalRequestResponseType = 'OFFERED' | 'CANNOT_FULFILL';
export type HospitalRequestResponseStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'CANCELLED';
export type HospitalBloodTransferStatus = 'ACCEPTED' | 'DISPATCHED' | 'RECEIVED' | 'CANCELLED';

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
  transfusedByStaffId?: string | null;
  unitDin?: string | null;
  patientEncounterId?: string | null;
  overrideReason?: string | null;
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
    donorNumber?: string | null;
    fullName: string;
    bloodGroup: BloodGroup;
    location: string;
    user: { email: string };
  };
};

export type DonorMatchContext = {
  bloodGroup: BloodGroup;
  compatible: boolean;
  eligible: boolean;
  available: boolean;
  inCooldown: boolean;
  locationSharingEnabled: boolean;
  distanceKm?: number | null;
};

export type BloodRequestItem = {
  id: string;
  hospitalCenterName?: string | null;
  ward?: string | null;
  patientName?: string | null;
  requestReference: string;
  hospitalPatientReference?: string | null;
  patientCode?: string | null;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  type: 'STANDARD' | 'EMERGENCY';
  priority: PriorityLevel;
  requestSource: RequestSource;
  status: RequestStatus;
  trackingStatus: RequestProgressStatus;
  location: string;
  emergencyLocation?: string | null;
  city?: string | null;
  region?: string | null;
  locationNotes?: string | null;
  requiredBy: string;
  createdAt: string;
  notes?: string | null;
  updates?: BloodRequestUpdateItem[];
  donorResponses?: DonorResponseItem[];
  hospitalResponses?: HospitalRequestResponseItem[];
  hospitalTransfers?: HospitalBloodTransferItem[];
  currentHospitalResponse?: HospitalRequestResponseItem | null;
  currentHospitalStock?: HospitalRequestStockSnapshot | null;
  donorMatchContext?: DonorMatchContext;
  isOwnRequest?: boolean;
  hospital?: { id?: string; hospitalName: string; location: string; city?: string | null; region?: string | null; contactPhone?: string | null };
};

export type HospitalRequestStockSnapshot = {
  requestedBloodGroup: BloodGroup;
  availableUnits: number;
  compatibleUnits: number;
  isLowStock: boolean;
  isCriticalStock: boolean;
};

export type HospitalRequestResponseItem = {
  id: string;
  requestId: string;
  respondingHospitalId: string;
  responseType: HospitalRequestResponseType;
  unitsOffered?: number | null;
  bloodGroupOffered?: BloodGroup | null;
  note?: string | null;
  status: HospitalRequestResponseStatus;
  createdAt: string;
  updatedAt: string;
  transfer?: HospitalBloodTransferItem | null;
  respondingHospital?: {
    id: string;
    hospitalName: string;
    location: string;
    city?: string | null;
    region?: string | null;
    contactPhone?: string | null;
  };
};

export type HospitalBloodTransferItem = {
  id: string;
  requestId: string;
  responseId: string;
  supplyingHospitalId: string;
  receivingHospitalId: string;
  bloodGroup: BloodGroup;
  units: number;
  dispatchedUnits?: number | null;
  receivedUnits?: number | null;
  status: HospitalBloodTransferStatus;
  dispatchNote?: string | null;
  dispatchReference?: string | null;
  receivedNote?: string | null;
  receivedCondition?: string | null;
  dispatchedAt?: string | null;
  receivedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  supplyingHospital?: {
    id: string;
    hospitalName: string;
    location: string;
    city?: string | null;
    region?: string | null;
    contactPhone?: string | null;
  };
  receivingHospital?: {
    id: string;
    hospitalName: string;
    location: string;
    city?: string | null;
    region?: string | null;
    contactPhone?: string | null;
  };
};

export type DonorMatch = {
  id: string;
  donorNumber?: string | null;
  fullName: string;
  firstName?: string | null;
  otherNames?: string | null;
  surname?: string | null;
  phone?: string | null;
  alternativePhoneNumber?: string | null;
  bloodGroup: BloodGroup;
  matchType?: 'EXACT' | 'COMPATIBLE';
  location: string;
  areaCommunity?: string | null;
  city?: string | null;
  region?: string | null;
  emergencyContactPhone: string;
  emergencyContactRelationship?: string | null;
  availabilityStatus?: boolean;
  eligibilityStatus?: boolean;
  operationalStatus?: 'AVAILABLE' | 'COOLDOWN' | 'COOLDOWN_ENDING_SOON' | 'DEFERRED' | 'UNAVAILABLE';
  contactAllowed?: boolean;
  scheduleAllowed?: boolean;
  lastDonationDate?: string | null;
  nextEligibilityDate?: string | null;
  cooldownDaysRemaining?: number;
  previousDonationCount?: number;
  responseRate?: number | null;
  responseRateLabel?: string;
  preferredHospital?: { id: string; hospitalName: string; location: string; city?: string | null; region?: string | null } | null;
  distanceKm?: number | null;
  withinRadius?: boolean | null;
  locationSharingEnabled?: boolean;
  mapLocationAvailable?: boolean;
  latitude?: number | null;
  longitude?: number | null;
  lastLocationUpdateAt?: string | null;
  clinicalStatus?: string | null;
  temporaryDeferralDuration?: string | null;
  donationHistory?: Array<{ donatedAt: string }>;
};

export type DonorLocatorResponse = {
  donors: DonorMatch[];
  summary: {
    totalMatches: number;
    totalBeforeRadius: number;
    availableCount: number;
    cooldownCount: number;
    deferredCount: number;
    mapReadyCount: number;
    origin: { latitude: number; longitude: number; source: 'query' | 'hospital'; hospitalName: string } | null;
    radiusFallback: { applied: boolean; requestedRadiusKm: number };
  };
};

export type AppointmentItem = {
  id: string;
  appointmentReference: string;
  scheduledAt: string;
  status: AppointmentStatus;
  appointmentType?: AppointmentType;
  notes?: string | null;
  completedAt?: string | null;
  unitsCollected?: number | null;
  volumeCollectedMl?: number | null;
  donationNumber?: string | null;
  donationNotes?: string | null;
  donationPostedAt?: string | null;
  donationId?: string | null;
  donor?: {
    id: string;
    donorNumber?: string | null;
    fullName: string;
    firstName?: string | null;
    otherNames?: string | null;
    surname?: string | null;
    bloodGroup: BloodGroup;
    location: string;
    availabilityStatus?: boolean;
    eligibilityStatus?: boolean;
    donationHistory?: Array<{ donatedAt: string }>;
  };
  bloodRequest?: { requestReference?: string | null };
};

export type DonationNumberPreview = {
  donationNumber: string;
};

export type NotificationItem = {
  id: string;
  title: string;
  body: string;
  delivered: boolean;
  createdAt: string;
};

export type TypeaheadPayload = {
  hospitals: Array<{ id: string; hospitalName: string; location: string }>;
  donors: Array<{ id: string; fullName: string; bloodGroup: BloodGroup; location: string }>;
  bloodGroups: string[];
  locations: string[];
  emergencyRequests: Array<{ id: string; bloodGroup: BloodGroup; location: string; unitsNeeded: number; priority: PriorityLevel }>;
  inventory: Array<{ id: string; bloodGroup: BloodGroup; availableUnits: number; hospital: { hospitalName: string; location: string } }>;
  donationCenters: Array<{ id: string; hospitalName: string; location: string }>;
};

export type HospitalProfile = {
  id: string;
  hospitalName: string;
  registrationCode: string;
  address: string;
  location: string;
  city?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  isApproved?: boolean;
  bloodBankAvailable?: boolean;
  contactName: string;
  contactPhone: string;
  inventoryItems?: InventoryItem[];
};

export type EligibilitySubmissionItem = {
  donorId: string;
  submittedAt: string;
  selectedHospitalId: string;
  donor: {
    fullName: string;
    bloodGroup: BloodGroup;
    location: string;
    email: string;
    eligibilityStatus: boolean;
    availabilityStatus: boolean;
  } | null;
  donorForm: {
    personalInformation: Record<string, unknown>;
    donationHistory: Record<string, unknown>;
    replacementFamilyDonor: Record<string, unknown>;
    healthQuestionnaire: Record<string, unknown>;
    donorDeclarationAccepted: boolean;
  };
  officeUse: {
    createdAt: string;
    officeUseOnly: Record<string, unknown>;
  } | null;
};

type ApiEnvelope<T> = { success: boolean; data: T };
type PaginationParams = { skip?: number; take?: number };

const unwrap = <T>(payload: ApiEnvelope<T> | T): T => ((payload as ApiEnvelope<T>)?.data ?? payload) as T;

export async function getHospitalProfile() {
  const response = await api.get<ApiEnvelope<HospitalProfile>>('/hospitals/profile');
  return unwrap(response.data);
}

export async function upsertHospitalProfile(payload: Omit<HospitalProfile, 'id'>) {
  const response = await api.post<ApiEnvelope<HospitalProfile>>('/hospitals/profile', payload);
  return unwrap(response.data);
}

export async function getHospitalInventory(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<InventoryItem[]>>('/inventory', { params });
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

export async function getInventoryLogs(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<InventoryLogItem[]>>('/inventory/logs', { params });
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
  hospitalCenterName?: string;
  ward?: string;
  patientName?: string;
  hospitalPatientReference?: string;
  bloodGroup: BloodGroup;
  unitsNeeded: number;
  type: 'STANDARD' | 'EMERGENCY';
  priority: PriorityLevel;
  requestSource?: RequestSource;
  location: string;
  emergencyLocation?: string;
  city?: string;
  region?: string;
  locationNotes?: string;
  requiredBy: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  radiusKm?: 5 | 10 | 20;
}) {
  const response = await api.post<ApiEnvelope<BloodRequestItem>>('/blood-requests', payload);
  return unwrap(response.data);
}

export async function getHospitalRequests(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<BloodRequestItem[]>>('/blood-requests/mine', { params });
  return unwrap(response.data);
}

export async function getHospitalActiveRequests(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<BloodRequestItem[]>>('/blood-requests/hospital-active', { params });
  return unwrap(response.data);
}

export async function getHospitalRequestHistory(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<BloodRequestItem[]>>('/blood-requests/hospital-history', { params });
  return unwrap(response.data);
}

export async function getHospitalActiveRequestById(id: string) {
  const response = await api.get<ApiEnvelope<BloodRequestItem>>(`/blood-requests/hospital-active/${id}`);
  return unwrap(response.data);
}

export async function respondToHospitalActiveRequest(
  id: string,
  payload: {
    responseType: HospitalRequestResponseType;
    unitsOffered?: number;
    bloodGroupOffered?: BloodGroup;
    note?: string;
  },
) {
  const response = await api.post<ApiEnvelope<HospitalRequestResponseItem>>(
    `/blood-requests/hospital-active/${id}/respond`,
    payload,
  );
  return unwrap(response.data);
}

export async function updateHospitalActiveResponseStatus(
  requestId: string,
  responseId: string,
  payload: { status: HospitalRequestResponseStatus },
) {
  const response = await api.patch<ApiEnvelope<HospitalRequestResponseItem>>(
    `/blood-requests/hospital-active/${requestId}/responses/${responseId}/status`,
    payload,
  );
  return unwrap(response.data);
}

export async function dispatchHospitalBloodTransfer(
  requestId: string,
  responseId: string,
  payload: { units: number; dispatchNote?: string; dispatchReference?: string },
) {
  const response = await api.post<ApiEnvelope<HospitalBloodTransferItem>>(
    `/blood-requests/hospital-active/${requestId}/responses/${responseId}/dispatch`,
    payload,
  );
  return unwrap(response.data);
}

export async function receiveHospitalBloodTransfer(
  requestId: string,
  responseId: string,
  payload: { units: number; receivedNote?: string; receivedCondition?: string },
) {
  const response = await api.post<ApiEnvelope<HospitalBloodTransferItem>>(
    `/blood-requests/hospital-active/${requestId}/responses/${responseId}/receive`,
    payload,
  );
  return unwrap(response.data);
}

export async function getAllBloodRequests(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<BloodRequestItem[]>>('/blood-requests', { params });
  return unwrap(response.data);
}

export async function getBloodRequestById(id: string) {
  const response = await api.get<ApiEnvelope<BloodRequestItem>>(`/blood-requests/${id}`);
  return unwrap(response.data);
}

export async function getDonorEmergencyRequests(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<BloodRequestItem[]>>('/blood-requests/donor-emergency', { params });
  return unwrap(response.data);
}

export async function getDonorEmergencyRequestById(id: string) {
  const response = await api.get<ApiEnvelope<BloodRequestItem>>(`/blood-requests/donor-emergency/${id}`);
  return unwrap(response.data);
}

export async function updateHospitalRequestStatus(id: string, status: RequestStatus, comment?: string) {
  const response = await api.patch<ApiEnvelope<BloodRequestItem>>(`/blood-requests/${id}/status`, { status, comment });
  return unwrap(response.data);
}

export async function updateHospitalActiveRequestStatus(id: string, status: RequestStatus, comment?: string) {
  const response = await api.patch<ApiEnvelope<BloodRequestItem>>(`/blood-requests/hospital-active/${id}/status`, {
    status,
    comment,
  });
  return unwrap(response.data);
}

export async function getBloodRequestUpdates(id: string) {
  const response = await api.get<ApiEnvelope<BloodRequestUpdateItem[]>>(`/blood-requests/${id}/updates`);
  return unwrap(response.data);
}

export async function createBloodRequestUpdate(
  id: string,
  payload: {
    newStatus: RequestProgressStatus;
    comment?: string;
    transfusedByStaffId?: string;
    unitDin?: string;
    patientEncounterId?: string;
  },
) {
  const response = await api.post<ApiEnvelope<{ request: BloodRequestItem; update: BloodRequestUpdateItem }>>(
    `/blood-requests/${id}/updates`,
    payload,
  );
  return unwrap(response.data);
}

export async function adminCorrectCompletionEvidence(
  id: string,
  payload: {
    transfusedByStaffId: string;
    unitDin: string;
    patientEncounterId: string;
    overrideReason: string;
  },
) {
  const response = await api.post<ApiEnvelope<{ message: string; update: BloodRequestUpdateItem }>>(
    `/blood-requests/${id}/completion-correction`,
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

export async function updateDonorAvailability(available: boolean) {
  const response = await api.patch<ApiEnvelope<{ availabilityStatus: boolean }>>('/donors/availability', { available });
  return unwrap(response.data);
}

export async function updateDonorResponse(
  id: string,
  payload: { responseStatus?: DonorResponseStatus; notes?: string },
) {
  const response = await api.patch<ApiEnvelope<DonorResponseItem>>(`/donor-responses/${id}`, payload);
  return unwrap(response.data);
}

export async function searchHospitalDonors(payload: {
  bloodGroup?: BloodGroup;
  location?: string;
  matchMode?: 'EXACT' | 'COMPATIBLE';
  availabilityFilter?: 'AVAILABLE_ONLY' | 'INCLUDE_COOLDOWN' | 'INCLUDE_DEFERRED' | 'ALL_APPROVED';
  radiusKm?: number;
  latitude?: number;
  longitude?: number;
  emergencyMode?: boolean;
}) {
  const response = await api.get<ApiEnvelope<DonorLocatorResponse>>('/hospitals/donor-search', { params: payload });
  return unwrap(response.data);
}

export async function getHospitalAppointments(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<AppointmentItem[]>>('/appointments', { params });
  return unwrap(response.data);
}

export async function getEligibleAppointmentDonors(params?: PaginationParams & { search?: string }) {
  const response = await api.get<ApiEnvelope<DonorMatch[]>>('/appointments/eligible-donors', { params });
  return unwrap(response.data);
}

export async function createHospitalAppointment(payload: {
  donorId: string;
  scheduledAt: string;
  appointmentType?: AppointmentType;
  bloodRequestId?: string;
  notes?: string;
}) {
  const response = await api.post<ApiEnvelope<AppointmentItem>>('/appointments/hospital', payload);
  return unwrap(response.data);
}

export async function updateHospitalAppointmentStatus(id: string, status: AppointmentStatus) {
  const response = await api.patch<ApiEnvelope<AppointmentItem>>(`/appointments/${id}/status`, { status });
  return unwrap(response.data);
}

export async function completeHospitalAppointmentDonation(
  id: string,
  payload: {
    unitsCollected: number;
    volumeCollectedMl?: number;
    donationNotes?: string;
  },
) {
  const response = await api.patch<ApiEnvelope<AppointmentItem>>(`/appointments/${id}/status`, {
    status: 'COMPLETED',
    ...payload,
  });
  return unwrap(response.data);
}

export async function getAppointmentDonationNumberPreview(id: string) {
  const response = await api.get<ApiEnvelope<DonationNumberPreview>>(`/appointments/${id}/donation-number-preview`);
  return unwrap(response.data);
}

export async function getHospitalNotifications(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<NotificationItem[]>>('/notifications', { params });
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

export async function getEligibilitySubmissions() {
  const response = await api.get<ApiEnvelope<EligibilitySubmissionItem[]>>('/hospitals/eligibility-submissions');
  return unwrap(response.data);
}

export async function submitOfficeUseForm(donorId: string, officeUseOnly: Record<string, unknown>) {
  const response = await api.post<ApiEnvelope<{ message: string }>>(`/hospitals/eligibility-submissions/${donorId}/office-use`, {
    officeUseOnly,
  });
  return unwrap(response.data);
}

export async function approveDonorEligibilityByHospital(donorId: string, approved: boolean) {
  const response = await api.patch<ApiEnvelope<any>>(`/hospitals/eligibility-submissions/${donorId}/approve`, { approved });
  return unwrap(response.data);
}

export async function getTypeaheadSuggestions(query: string) {
  const response = await api.get<ApiEnvelope<TypeaheadPayload>>('/hospitals/typeahead', { params: { q: query } });
  return unwrap(response.data);
}
