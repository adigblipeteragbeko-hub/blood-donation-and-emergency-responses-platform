import api from './api';

export type BloodGroupCode =
  | 'UNKNOWN'
  | 'O_POS'
  | 'O_NEG'
  | 'A_POS'
  | 'A_NEG'
  | 'B_POS'
  | 'B_NEG'
  | 'AB_POS'
  | 'AB_NEG';

export type PriorityLevel = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type DonorReviewStatus =
  | 'SUBMITTED'
  | 'HOSPITAL_REVIEW'
  | 'OFFICE_USE_COMPLETED'
  | 'APPROVED'
  | 'REJECTED';

export type OverviewCard = {
  key: string;
  label: string;
  value: number;
  suffix?: string;
  tone: 'primary' | 'warning' | 'neutral' | 'success' | 'danger';
};

export type QuickAction = {
  label: string;
  href: string;
  color: 'primary' | 'navy' | 'amber';
};

export type DashboardOverview = {
  summaryCards: OverviewCard[];
  quickActions: QuickAction[];
};

export type InventoryMonitorItem = {
  bloodGroup: BloodGroupCode;
  availableUnits: number;
  expiringUnits: number;
  status: 'stable' | 'low' | 'critical';
  lowThreshold: number;
  criticalThreshold: number;
  lastUpdated: string | null;
  expiryWarning: boolean;
};

export type EmergencyRequestMonitorItem = {
  id: string;
  bloodType: BloodGroupCode;
  hospitalName: string;
  urgencyLevel: PriorityLevel;
  requestStatus: 'pending' | 'matching' | 'donor_responded' | 'fulfilled' | 'escalated' | 'cancelled';
  rawStatus: string;
  trackingStatus: string;
  timeCreated: string;
  matchedDonorsCount: number;
  donorResponseCount: number;
  unitsNeeded: number;
  location: string;
};

export type ActivityFeedItem = {
  id: string;
  actorUserId?: string | null;
  actorName?: string | null;
  type: string;
  module: string;
  title: string;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  donorId?: string | null;
  hospitalId?: string | null;
  bloodRequestId?: string | null;
  metadata?: unknown;
  createdAt: string;
};

export type DashboardNotification = {
  id: string;
  type: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  title: string;
  body: string;
  createdAt: string;
};

export type InboxNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  delivered: boolean;
  userEmail: string;
  createdAt: string;
};

export type DonorReviewItem = {
  id: string;
  donorId: string;
  selectedHospitalId?: string | null;
  status: DonorReviewStatus;
  reviewNotes?: string | null;
  officeUseNotes?: string | null;
  submittedAt: string;
  hospitalReviewedAt?: string | null;
  officeCompletedAt?: string | null;
  approvedAt?: string | null;
  rejectedAt?: string | null;
  reviewerId?: string | null;
  createdAt: string;
  updatedAt: string;
  donor: {
    id: string;
    fullName: string;
    bloodGroup: BloodGroupCode;
    location: string;
    phone?: string | null;
    user: { email: string };
  };
  selectedHospital?: {
    id: string;
    hospitalName: string;
    location: string;
  } | null;
  reviewer?: { email: string } | null;
};

export type AuditLogItem = {
  id: string;
  actorUserId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  description?: string | null;
  ipAddress?: string | null;
  metadata?: unknown;
  module?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  createdAt: string;
  actor?: {
    id: string;
    email: string;
    role: string;
  } | null;
};

export type ReportPoint = { month: string; value: number };
export type ValuePoint = { label: string; value: number };
export type HospitalPerformancePoint = {
  hospitalName: string;
  totalRequests: number;
  completedRequests: number;
  completionRate: number;
};

export type SecurityEventItem = {
  id: string;
  actorUserId?: string | null;
  email?: string | null;
  eventType: string;
  severity: 'INFO' | 'WARNING' | 'CRITICAL';
  description: string;
  ipAddress?: string | null;
  createdAt: string;
  actor?: { email: string } | null;
};

export type ActiveSessionItem = {
  id: string;
  email: string;
  role: string;
  createdAt: string;
  expiresAt: string;
};

export type AdminDashboardSearchResults = {
  donors: Array<{
    id: string;
    fullName: string;
    bloodGroup: BloodGroupCode;
    location: string;
    phone?: string | null;
    user: { email: string };
  }>;
  hospitals: Array<{
    id: string;
    hospitalName: string;
    registrationCode: string;
    location: string;
  }>;
  requests: Array<{
    id: string;
    requestReference: string;
    hospitalPatientReference?: string | null;
    patientName?: string | null;
    patientCode?: string | null;
    bloodGroup: BloodGroupCode;
    priority: PriorityLevel;
    location: string;
    hospital: { hospitalName: string };
  }>;
  appointments: Array<{
    id: string;
    appointmentReference: string;
    scheduledAt: string;
    status: string;
    donor: { fullName: string };
    hospital: { hospitalName: string };
  }>;
  inventory: Array<{
    id: string;
    bloodGroup: BloodGroupCode;
    availableUnits: number;
    hospital: { hospitalName: string };
  }>;
};

const unwrap = <T>(response: { data: { data: T } }) => response.data.data;

const cleanParams = (params: Record<string, string | number | undefined>) =>
  Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== ''),
  );

export async function getAdminDashboardOverview() {
  return unwrap<DashboardOverview>(await api.get('/admin/dashboard/overview'));
}

export async function getAdminInventoryMonitoring() {
  return unwrap<InventoryMonitorItem[]>(await api.get('/admin/dashboard/inventory-monitor'));
}

export async function getAdminEmergencyRequests(params: Record<string, string | number | undefined>) {
  return unwrap<{
    total: number;
    items: EmergencyRequestMonitorItem[];
    hospitals: { id: string; hospitalName: string }[];
  }>(await api.get('/admin/dashboard/emergency-requests', { params: cleanParams(params) }));
}

export async function getAdminActivityFeed(params: Record<string, string | number | undefined>) {
  return unwrap<{ total: number; items: ActivityFeedItem[] }>(
    await api.get('/admin/dashboard/activity-feed', { params: cleanParams(params) }),
  );
}

export async function getAdminNotifications() {
  return unwrap<{ systemNotifications: DashboardNotification[]; inbox: InboxNotification[] }>(
    await api.get('/admin/dashboard/notifications'),
  );
}

export async function getAdminDonorReviews(params: Record<string, string | number | undefined>) {
  return unwrap<{
    total: number;
    items: DonorReviewItem[];
    hospitals: { id: string; hospitalName: string }[];
  }>(await api.get('/admin/dashboard/donor-reviews', { params: cleanParams(params) }));
}

export async function updateAdminDonorReview(
  id: string,
  payload: { status: DonorReviewStatus; reviewNotes?: string; officeUseNotes?: string },
) {
  return unwrap<DonorReviewItem>(await api.patch(`/admin/dashboard/donor-reviews/${id}`, payload));
}

export async function getAdminAuditLogs(params: Record<string, string | number | undefined>) {
  return unwrap<{
    total: number;
    items: AuditLogItem[];
    users: { id: string; email: string; role?: string }[];
  }>(await api.get('/admin/dashboard/audit-logs', { params: cleanParams(params) }));
}

export async function getAdminReports() {
  return unwrap<{
    donationsByMonth: ReportPoint[];
    requestTrends: ReportPoint[];
    mostRequestedBloodTypes: Array<{ bloodType: BloodGroupCode; value: number }>;
    donorResponseRates: ValuePoint[];
    hospitalPerformance: HospitalPerformancePoint[];
    shortageTrends: InventoryMonitorItem[];
    proactiveMobilization?: {
      atRiskHospitals?: Array<{
        hospitalName: string;
        bloodGroup: string;
        level: string;
        currentUnits: number;
        createdAt: string;
      }>;
      campaigns?: Array<{
        id: string;
        hospitalName?: string | null;
        bloodGroup?: string | null;
        warningLevel?: string | null;
        targetDonorCount?: number | null;
        donorsNotified?: number | null;
        responseCount?: number | null;
        responseRate?: number | null;
        positiveResponses?: number | null;
        createdAt?: string | null;
      }>;
    };
  }>(await api.get('/admin/dashboard/reports'));
}

export async function getAdminSecurityMonitoring() {
  return unwrap<{
    recentAdminLogins: SecurityEventItem[];
    failedLoginAttempts: SecurityEventItem[];
    suspiciousAccessAttempts: SecurityEventItem[];
    activeSessions: ActiveSessionItem[];
  }>(await api.get('/admin/dashboard/security'));
}

export async function searchAdminDashboard(q: string) {
  return unwrap<AdminDashboardSearchResults>(await api.get('/admin/dashboard/search', { params: { q } }));
}
