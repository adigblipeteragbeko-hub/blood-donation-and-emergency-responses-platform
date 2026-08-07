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
export type AppointmentStatus =
  | 'SCHEDULED'
  | 'PENDING_CONFIRMATION'
  | 'CONFIRMED'
  | 'DONOR_ARRIVED'
  | 'IN_PROGRESS'
  | 'RESCHEDULE_REQUESTED'
  | 'RESCHEDULED'
  | 'DECLINED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'MISSED'
  | 'NO_SHOW';
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
  expiringUnits?: number;
  expiryWindowDays?: number;
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

export type StockWarningLevel = 'STABLE' | 'WATCH' | 'LIKELY_SHORTAGE' | 'CRITICAL';

export type BloodStockWarningItem = {
  hospitalId: string;
  hospital?: { id: string; hospitalName: string; city?: string | null; region?: string | null };
  bloodGroup: BloodGroup;
  level: StockWarningLevel;
  status?: 'Critical' | 'Low Stock' | 'Monitor' | 'Healthy';
  currentUnits: number;
  usableUnits?: number;
  minimumStockLevel?: number;
  criticalStockLevel?: number;
  forecastPeriodHours?: number;
  activeDemandUnits: number;
  activeRequestedUnits?: number;
  urgentRequestedUnits?: number;
  expiringUnits: number;
  unitsExpiringSoon?: number;
  expiryWindowDays?: number;
  incomingTransferUnits: number;
  scheduledDonationUnits: number;
  recentIncomingUnits?: number;
  recentOutgoingUnits?: number;
  eligibleDonorCount?: number;
  exactAvailableDonors?: number;
  compatibleAvailableDonors?: number;
  averageDailyUsage?: number | null;
  usageHistoryCount?: number;
  riskScore?: number;
  riskLevel?: 'Low' | 'Moderate' | 'High' | 'Critical';
  dataFreshness?: string;
  lastUpdatedAt?: string | null;
  recommendedActionType?: string;
  explanation: string;
  recommendedAction?: string | null;
  riskFactors?: string[];
};

export type MobilizationPreview = {
  hospitalId: string;
  hospitalName: string;
  bloodGroup: BloodGroup;
  warningLevel: StockWarningLevel;
  forecastPeriodHours: number;
  radiusKm: number;
  eligibleDonorCount: number;
  donorBloodGroups: Record<string, number>;
  previewNote: string;
};

export type MobilizationCampaign = {
  id: string;
  campaignName: string;
  hospital?: { id: string; hospitalName: string; city?: string | null; region?: string | null };
  bloodGroup: BloodGroup;
  warningLevel: StockWarningLevel;
  status: string;
  forecastPeriodHours: number;
  radiusKm: number;
  eligibleDonors: number;
  donorsNotified: number;
  interestedDonors: number;
  declinedResponses: number;
  appointmentRequests: number;
  confirmedAppointments: number;
  completedDonations: number;
  donatedUnits: number;
  responseRate: number;
  appointmentConversionRate: number;
  donationSuccessRate: number;
  warningReason?: string | null;
  message: string;
  sentAt?: string | null;
  createdAt: string;
  responses: Array<{
    id: string;
    responseStatus: 'INTERESTED' | 'NOT_AVAILABLE' | 'APPOINTMENT_SCHEDULED';
    respondedAt: string;
    notes?: string | null;
    donor: {
      id: string;
      donorNumber?: string | null;
      fullName: string;
      bloodGroup: BloodGroup;
      location: string;
      lastDonationDate?: string | null;
      nextEligibilityDate?: string | null;
    };
    appointments: Array<{
      id: string;
      appointmentReference: string;
      status: AppointmentStatus;
      scheduledAt: string;
      donationPostedAt?: string | null;
    }>;
    donations: Array<{
      id: string;
      donationNumber?: string | null;
      unitsDonated: number;
      donatedAt: string;
    }>;
  }>;
};

export type BloodStockTrendResponse = {
  windowDays: number;
  generatedAt: string;
  trends: Array<{
    bloodGroup: BloodGroup;
    points: Array<{ date: string; units: number }>;
    lowEvents: number;
    criticalEvents: number;
  }>;
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
  updatedAt?: string;
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
  locationFreshness?: {
    status: 'FRESH' | 'STALE' | 'UNAVAILABLE';
    label: string;
    ageMinutes: number | null;
    thresholdHours: number;
  };
  emergencyNotificationConsent?: boolean;
  matchReasons?: string[];
  matchReasonSummary?: string;
  clinicalStatus?: string | null;
  temporaryDeferralDuration?: string | null;
  donationHistory?: Array<{ donatedAt: string }>;
};

export type DonorLocatorResponse = {
  donors: DonorMatch[];
  summary: {
    totalMatches: number;
    evaluatedDonors?: number;
    totalBeforeRadius: number;
    availableCount: number;
    cooldownCount: number;
    deferredCount: number;
    mapReadyCount: number;
    staleLocationCount?: number;
    origin: { latitude: number; longitude: number; source: 'request' | 'query' | 'hospital'; hospitalName: string; location?: string | null } | null;
    requestContext?: {
      id: string;
      requestReference: string;
      bloodGroup: BloodGroup;
      bloodComponent: string;
      unitsNeeded: number;
      priority: PriorityLevel;
      requestSource: RequestSource;
      type: 'STANDARD' | 'EMERGENCY';
      location: string;
      city?: string | null;
      region?: string | null;
      requestingHospital: { id: string; hospitalName: string; location: string; city?: string | null; region?: string | null };
      loggedInHospital: { id: string; hospitalName: string; location: string; city?: string | null; region?: string | null };
      interHospital: boolean;
    } | null;
    radiusFallback: { applied: boolean; requestedRadiusKm: number };
    exclusionSummary?: Record<string, number>;
  };
};

export type AppointmentItem = {
  id: string;
  appointmentReference: string;
  scheduledAt: string;
  status: AppointmentStatus;
  appointmentType?: AppointmentType;
  notes?: string | null;
  confirmedAt?: string | null;
  reschedulePreferredAt?: string | null;
  rescheduleReason?: string | null;
  declinedAt?: string | null;
  declineReason?: string | null;
  declineNotes?: string | null;
  cancelledBy?: string | null;
  cancelledAt?: string | null;
  cancellationReason?: string | null;
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
  hospital?: { id: string; hospitalName: string; location: string };
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
  type?: string | null;
  bloodRequestId?: string | null;
  campaignId?: string | null;
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
  logoUrl?: string | null;
  logoUpdatedAt?: string | null;
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
export type AppointmentDateFilterParams = {
  dateFilter?: 'today';
  localDate?: string;
  timezoneOffsetMinutes?: number;
};

const unwrap = <T>(payload: ApiEnvelope<T> | T): T => ((payload as ApiEnvelope<T>)?.data ?? payload) as T;

export async function getHospitalProfile() {
  const response = await api.get<ApiEnvelope<HospitalProfile>>('/hospitals/profile');
  return unwrap(response.data);
}

export async function upsertHospitalProfile(payload: Omit<HospitalProfile, 'id'>) {
  const response = await api.post<ApiEnvelope<HospitalProfile>>('/hospitals/profile', payload);
  return unwrap(response.data);
}

export async function updateHospitalLogo(logoUrl: string) {
  const response = await api.patch<ApiEnvelope<HospitalProfile>>('/hospitals/profile/logo', { logoUrl });
  return unwrap(response.data);
}

export async function getHospitalInventory(params?: PaginationParams) {
  const response = await api.get<ApiEnvelope<InventoryItem[]>>('/inventory', { params });
  return unwrap(response.data);
}

export async function upsertHospitalInventory(payload: { bloodGroup: BloodGroup; availableUnits: number; reason?: string }) {
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

export async function getBloodStockWarnings() {
  const response = await api.get<ApiEnvelope<BloodStockWarningItem[]>>('/inventory/early-warning');
  return unwrap(response.data);
}

export async function mobilizeCompatibleDonors(payload: {
  bloodGroup: BloodGroup;
  warningLevel?: StockWarningLevel;
  message?: string;
  forecastPeriodHours?: number;
  radiusKm?: number;
}) {
  const response = await api.post<ApiEnvelope<{
    success: boolean;
    bloodGroup: BloodGroup;
    exactMatchCount: number;
    compatibleMatchCount: number;
    targetDonorCount: number;
    targetedDonorCount: number;
    notificationsCreated: number;
    notificationsSkipped: number;
    skippedReasons: Record<string, number>;
    auditLogCreated: boolean;
    hospitalActivityCreated: boolean;
    campaignReference: string | null;
    createdAt: string;
    message: string;
  }>>('/inventory/early-warning/mobilize', payload);
  return unwrap(response.data);
}

export async function previewCompatibleDonors(payload: {
  bloodGroup: BloodGroup;
  warningLevel?: StockWarningLevel;
  forecastPeriodHours?: number;
  radiusKm?: number;
}) {
  const response = await api.post<ApiEnvelope<MobilizationPreview>>('/inventory/early-warning/preview', payload);
  return unwrap(response.data);
}

export async function getMobilizationCampaigns() {
  const response = await api.get<ApiEnvelope<MobilizationCampaign[]>>('/inventory/early-warning/campaigns');
  return unwrap(response.data);
}

export async function getBloodStockTrends(days = 30) {
  const response = await api.get<ApiEnvelope<BloodStockTrendResponse>>('/inventory/early-warning/trends', { params: { days } });
  return unwrap(response.data);
}

export async function respondToMobilizationCampaign(payload: {
  campaignId: string;
  responseStatus: 'INTERESTED' | 'NOT_AVAILABLE' | 'APPOINTMENT_SCHEDULED';
  notes?: string;
}) {
  const response = await api.post<ApiEnvelope<{ responseStatus: string; message: string }>>('/notifications/mobilization-response', payload);
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

export async function getHospitalActiveRequestSummary() {
  const response = await api.get<ApiEnvelope<{
    total: number;
    activeStatusesIncluded: RequestStatus[];
    requestSourcesIncludedForOtherHospitals: RequestSource[];
  }>>('/blood-requests/hospital-active/summary');
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

export async function updateHospitalActiveRequest(
  id: string,
  payload: Partial<{
    hospitalCenterName: string;
    ward: string;
    hospitalPatientReference: string;
    bloodGroup: BloodGroup;
    unitsNeeded: number;
    priority: PriorityLevel;
    requestSource: RequestSource;
    location: string;
    emergencyLocation: string;
    city: string;
    region: string;
    locationNotes: string;
    latitude: number;
    longitude: number;
    requiredBy: string;
    notes: string;
    lastKnownUpdatedAt: string;
  }>,
) {
  const response = await api.patch<ApiEnvelope<BloodRequestItem>>(`/blood-requests/hospital-active/${id}`, payload);
  return unwrap(response.data);
}

export async function cancelHospitalActiveRequest(id: string, payload?: { reason?: string; lastKnownUpdatedAt?: string }) {
  const response = await api.patch<ApiEnvelope<BloodRequestItem>>(`/blood-requests/hospital-active/${id}/cancel`, payload ?? {});
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
  requestId?: string;
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

export async function getHospitalAppointments(params?: PaginationParams & AppointmentDateFilterParams) {
  const response = await api.get<ApiEnvelope<AppointmentItem[]>>('/appointments', { params });
  return unwrap(response.data);
}

export async function getHospitalAppointmentSummary(params?: AppointmentDateFilterParams) {
  const response = await api.get<ApiEnvelope<{
    total: number;
    todayStatusesIncluded: AppointmentStatus[];
    dateField: 'scheduledAt';
    dateFilter: 'today' | null;
    localDate: string | null;
    timezoneOffsetMinutes: number;
  }>>('/appointments/summary', { params });
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

export async function acceptAppointment(id: string) {
  const response = await api.patch<ApiEnvelope<AppointmentItem>>(`/appointments/${id}/accept`);
  return unwrap(response.data);
}

export async function requestAppointmentReschedule(id: string, payload: { preferredAt: string; reason?: string }) {
  const response = await api.patch<ApiEnvelope<AppointmentItem>>(`/appointments/${id}/reschedule-request`, payload);
  return unwrap(response.data);
}

export async function declineAppointment(id: string, payload: { reason: string; notes?: string }) {
  const response = await api.patch<ApiEnvelope<AppointmentItem>>(`/appointments/${id}/decline`, payload);
  return unwrap(response.data);
}

export async function cancelAppointment(id: string) {
  const response = await api.patch<ApiEnvelope<AppointmentItem>>(`/appointments/${id}/cancel`);
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
