import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  type AppointmentItem,
  type BloodRequestItem,
  type HospitalProfile,
  type InventoryItem,
  type InventoryLogItem,
  type NotificationItem,
  type MobilizationPreview,
  type MobilizationCampaign,
  type BloodStockTrendResponse,
  type BloodStockWarningItem,
  type BloodGroup,
  type StockWarningLevel,
  getBloodStockTrends,
  getBloodStockWarnings,
  getMobilizationCampaigns,
  mobilizeCompatibleDonors,
  previewCompatibleDonors,
  getHospitalAppointmentSummary,
  getHospitalAppointments,
  getHospitalInventory,
  getInventoryLogs,
  getHospitalProfile,
  getHospitalNotifications,
  getHospitalRequests,
  getHospitalActiveRequests,
  getHospitalActiveRequestSummary,
  getHospitalRequestHistory,
  searchHospitalDonors,
} from '../services/hospital-portal';
import { AppIcon } from '../components/ui/AppIcon';
import { SmartAvatar } from '../components/SmartAvatar';
import { createRealtimeSocket } from '../services/live-map';
import { formatHospitalDisplayName } from '../utils/hospital-display';
import { getTodayAppointmentQuery } from '../utils/appointment-date-filter';

type RecentActivityItem = {
  id: string;
  title: string;
  timestamp?: string | null;
};

type HospitalBloodStatus = 'STABLE' | 'WARNING' | 'CRITICAL' | 'EMERGENCY';

type HospitalBloodStatusSummary = {
  status: HospitalBloodStatus;
  title: string;
  message: string;
  indicatorClassName: string;
  bannerClassName: string;
};

type EmergencyActionItem = {
  id: string;
  label: string;
  description: string;
  priority: string;
  kind: 'link' | 'button';
  to?: string;
  onClick?: () => void;
  ariaLabel: string;
};

const ACTION_CENTER_COLLAPSED_KEY = 'hospital-emergency-action-center-collapsed';
const ACTION_CENTER_LAST_SEEN_KEY = 'hospital-emergency-action-center-last-seen-request';
const DEFAULT_EMERGENCY_SEARCH_RADIUS_KM = 25;
const SUMMARY_CARD_CLASS =
  'card block cursor-pointer transition hover:border-primary/40 hover:shadow-md focus:outline-none focus:ring-4 focus:ring-red-100';

const CORE_BLOOD_GROUPS: BloodGroup[] = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'];

const getSettledValue = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value : fallback;

const formatDate = (value?: string | null) => {
  if (!value) {
    return 'Date not recorded';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Date not recorded' : date.toLocaleDateString();
};

const formatDateTime = (value?: string | null) => {
  if (!value) {
    return 'Date not recorded';
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date not recorded'
    : date.toLocaleString(undefined, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      });
};

const formatRelativeTime = (value?: Date | null) => {
  if (!value) return 'Not available';
  const diffMs = Date.now() - value.getTime();
  if (diffMs < 0) return 'Just now';
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `Updated ${diffSeconds} second${diffSeconds === 1 ? '' : 's'} ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `Updated ${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  return `Updated ${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
};

const getFreshnessClassName = (value?: Date | null) => {
  if (!value) return 'bg-slate-100 text-slate-700';
  const diffMinutes = (Date.now() - value.getTime()) / 60000;
  if (diffMinutes <= 5) return 'bg-green-100 text-green-800';
  if (diffMinutes <= 15) return 'bg-amber-100 text-amber-800';
  return 'bg-red-100 text-red-800';
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const formatBloodGroup = (value: string) =>
  value.replace('_POS', '+').replace('_NEG', '-').replace('UNKNOWN', 'Unknown');

const buildEarlyWarningDonorSearchPath = (bloodGroup: BloodGroup) => {
  const params = new URLSearchParams({
    bloodGroup,
    compatible: 'true',
    available: 'true',
    eligible: 'true',
    source: 'early-warning',
    radiusKm: String(DEFAULT_EMERGENCY_SEARCH_RADIUS_KM),
  });
  return `/hospital/donor-search?${params.toString()}`;
};

const buildWarningCampaignMessage = (hospitalName: string, bloodGroup: BloodGroup) =>
  `Urgent blood donation appeal: ${hospitalName} currently requires ${formatBloodGroup(bloodGroup)} donors. Eligible and available donors are encouraged to respond.`;

const getWarningLevelLabel = (level: StockWarningLevel) => {
  if (level === 'CRITICAL') return 'Critical';
  if (level === 'LIKELY_SHORTAGE') return 'Low Stock';
  if (level === 'WATCH') return 'Monitor';
  return 'Healthy';
};

const formatStatusLabel = (value?: string | null) => {
  if (!value) return 'Not available';
  return value.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
};

const getWarningLevelClassName = (level: StockWarningLevel) => {
  if (level === 'CRITICAL') return 'bg-red-100 text-red-800 border-red-200';
  if (level === 'LIKELY_SHORTAGE') return 'bg-orange-100 text-orange-800 border-orange-200';
  if (level === 'WATCH') return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-green-100 text-green-800 border-green-200';
};

function getRuleTriggers(item: BloodStockWarningItem) {
  const triggers: string[] = [];
  const currentUnits = Number(item.currentUnits ?? 0);
  const activeDemand = Number(item.activeDemandUnits ?? 0);
  const expiringUnits = Number(item.expiringUnits ?? 0);
  const scheduledDonationUnits = Number(item.scheduledDonationUnits ?? 0);
  const incomingTransferUnits = Number(item.incomingTransferUnits ?? 0);

  if (currentUnits < activeDemand) {
    triggers.push('Inventory < Emergency Demand');
  }
  if (currentUnits <= Number(item.criticalStockLevel ?? 0) || item.level === 'CRITICAL') {
    triggers.push('Inventory <= Critical Threshold');
  }
  if (expiringUnits > Math.max(0, currentUnits - activeDemand)) {
    triggers.push('Expiring Units > Remaining Buffer');
  }
  if (scheduledDonationUnits + incomingTransferUnits < activeDemand) {
    triggers.push('Scheduled/Incoming Units < Emergency Demand');
  }

  return triggers.length > 0 ? triggers : ['Rule-based early-warning threshold reached'];
}

const getWarningUsableUnits = (item: BloodStockWarningItem) => {
  const currentUnits = Number(item.currentUnits ?? 0);
  const expiringUnits = Number(item.expiringUnits ?? 0);
  const activeDemand = Number(item.activeDemandUnits ?? 0);
  return Number(item.usableUnits ?? Math.max(0, currentUnits - expiringUnits - activeDemand));
};

const getCompatibleDonorGroups = (bloodGroup: BloodGroup): BloodGroup[] => {
  const compatibility: Record<BloodGroup, BloodGroup[]> = {
    UNKNOWN: [],
    O_NEG: ['O_NEG'],
    O_POS: ['O_POS', 'O_NEG'],
    A_NEG: ['A_NEG', 'O_NEG'],
    A_POS: ['A_POS', 'A_NEG', 'O_POS', 'O_NEG'],
    B_NEG: ['B_NEG', 'O_NEG'],
    B_POS: ['B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
    AB_NEG: ['AB_NEG', 'A_NEG', 'B_NEG', 'O_NEG'],
    AB_POS: ['AB_POS', 'AB_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
  };
  return compatibility[bloodGroup] ?? [];
};

const getRiskLabel = (score: number) => {
  if (score >= 75) return 'Critical';
  if (score >= 50) return 'High';
  if (score >= 25) return 'Moderate';
  return 'Low';
};

const getRiskClassName = (score: number) => {
  if (score >= 75) return 'bg-red-100 text-red-800 border-red-200';
  if (score >= 50) return 'bg-orange-100 text-orange-800 border-orange-200';
  if (score >= 25) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-green-100 text-green-800 border-green-200';
};

const formatRiskReason = (reason?: string) => {
  if (!reason) return 'Current stock and demand require operational review.';
  const stockRisk = reason.match(/stock level risk:\s*(\d+)\s*\/\s*40/i);
  if (!stockRisk) return reason;
  const value = Number(stockRisk[1]);
  if (value >= 40) return 'Stock is below the critical threshold.';
  if (value >= 20) return 'Stock is approaching the minimum threshold.';
  return 'Stock is currently above the minimum threshold.';
};

const addMinutes = (value: Date, minutes: number) => {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
};

const getMsUntilNextLocalDay = () => {
  const now = new Date();
  const nextDay = new Date(now);
  nextDay.setHours(24, 0, 5, 0);
  return Math.max(1000, nextDay.getTime() - now.getTime());
};

function getHospitalBloodStatus(
  warnings: BloodStockWarningItem[],
  requests: BloodRequestItem[],
  inventory: InventoryItem[],
): HospitalBloodStatusSummary {
  const criticalItems = warnings.filter((item) => item.level === 'CRITICAL');
  const likelyShortageItems = warnings.filter((item) => item.level === 'LIKELY_SHORTAGE');
  const watchItems = warnings.filter((item) => item.level === 'WATCH');
  const inventoryByBloodGroup = new Map(inventory.map((item) => [item.bloodGroup, Number(item.availableUnits ?? 0)]));
  const activeEmergencyDemand = new Map<BloodGroup, number>();
  requests
    .filter((request) => request.type === 'EMERGENCY' && isActiveByFulfillment(request))
    .forEach((request) => {
      const remainingUnits = Math.max(Number(request.unitsNeeded ?? 0) - getReceivedUnits(request), 0);
      const current = activeEmergencyDemand.get(request.bloodGroup) ?? 0;
      activeEmergencyDemand.set(request.bloodGroup, current + remainingUnits);
    });
  const uncoveredEmergencyGroups = Array.from(activeEmergencyDemand.entries()).filter(([bloodGroup, demandedUnits]) => {
    const currentUnits = inventoryByBloodGroup.get(bloodGroup) ?? warnings.find((item) => item.bloodGroup === bloodGroup)?.currentUnits ?? 0;
    return demandedUnits > Number(currentUnits);
  });
  const activeCriticalEmergency = requests.some((request) =>
    request.type === 'EMERGENCY' &&
    request.priority === 'CRITICAL' &&
    isActiveByFulfillment(request),
  );
  const emergencyRisk = criticalItems.some((item) => {
    const usableUnits = getWarningUsableUnits(item);
    return usableUnits <= 0;
  });

  if (emergencyRisk || uncoveredEmergencyGroups.length > 0) {
    return {
      status: 'EMERGENCY',
      title: 'Emergency',
      message: uncoveredEmergencyGroups.length > 0
        ? 'Active emergency demand is higher than current stock for one or more blood groups. Notify compatible donors and coordinate transfers immediately.'
        : 'One or more blood groups may be exhausted within 24 hours. Notify compatible donors, launch emergency campaigns, and coordinate blood transfers immediately.',
      indicatorClassName: 'bg-red-600 shadow-red-200',
      bannerClassName: 'border-red-200 bg-red-50 text-red-950',
    };
  }

  if (activeCriticalEmergency || criticalItems.length > 0 || likelyShortageItems.length >= 2) {
    return {
      status: 'CRITICAL',
      title: 'Critical',
      message: activeCriticalEmergency
        ? 'A critical emergency request is active. Review stock, nearby hospitals, and compatible donor availability now.'
        : 'Multiple blood groups are approaching critical operating levels. Immediate intervention is recommended.',
      indicatorClassName: 'bg-orange-500 shadow-orange-200',
      bannerClassName: 'border-orange-200 bg-orange-50 text-orange-950',
    };
  }

  if (likelyShortageItems.length > 0 || watchItems.length > 0) {
    return {
      status: 'WARNING',
      title: 'Warning',
      message: 'One or more blood groups are below comfortable operating levels. Proactive donor mobilization is recommended.',
      indicatorClassName: 'bg-amber-400 shadow-amber-200',
      bannerClassName: 'border-amber-200 bg-amber-50 text-amber-950',
    };
  }

  return {
    status: 'STABLE',
    title: 'Stable',
    message: 'All critical blood groups are above minimum operating thresholds. No immediate action is required.',
    indicatorClassName: 'bg-green-500 shadow-green-200',
    bannerClassName: 'border-green-200 bg-green-50 text-green-950',
  };
}

function getReceivedUnits(request: BloodRequestItem) {
  const transferMap = new Map<string, NonNullable<NonNullable<BloodRequestItem['hospitalResponses']>[number]['transfer']>>();
  request.hospitalTransfers?.forEach((transfer) => {
    transferMap.set(transfer.id, transfer);
  });
  request.hospitalResponses?.forEach((response) => {
    if (response.transfer) {
      transferMap.set(response.transfer.id, response.transfer);
    }
  });

  return Array.from(transferMap.values()).reduce((sum, transfer) => sum + Number(transfer.receivedUnits ?? 0), 0);
}

function isActiveByFulfillment(request: BloodRequestItem) {
  if (request.status === 'CANCELLED' || request.status === 'FULFILLED') {
    return false;
  }
  const unitsNeeded = Number(request.unitsNeeded ?? 0);
  if (unitsNeeded <= 0) {
    return request.status === 'OPEN' || request.status === 'MATCHING';
  }
  return getReceivedUnits(request) < unitsNeeded;
}

export default function HospitalDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [stockUnits, setStockUnits] = useState(0);
  const [activeRequests, setActiveRequests] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [availableApprovedDonors, setAvailableApprovedDonors] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);
  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([]);
  const [requestItems, setRequestItems] = useState<BloodRequestItem[]>([]);
  const [stockWarnings, setStockWarnings] = useState<BloodStockWarningItem[]>([]);
  const [activeCoordinationRequests, setActiveCoordinationRequests] = useState<BloodRequestItem[]>([]);
  const [campaigns, setCampaigns] = useState<MobilizationCampaign[]>([]);
  const [stockTrends, setStockTrends] = useState<BloodStockTrendResponse | null>(null);
  const [lastAnalysisTime, setLastAnalysisTime] = useState<Date | null>(null);
  const [mobilizationMessage, setMobilizationMessage] = useState('');
  const [mobilizationPreviews, setMobilizationPreviews] = useState<Record<string, MobilizationPreview>>({});
  const [expandedWarnings, setExpandedWarnings] = useState<Record<string, boolean>>({});
  const [compatibilitySummary, setCompatibilitySummary] = useState<BloodGroup | null>(null);
  const [campaignRequest, setCampaignRequest] = useState<BloodRequestItem | null>(null);
  const [campaignMessage, setCampaignMessage] = useState('');
  const [campaignSending, setCampaignSending] = useState(false);
  const [warningCampaign, setWarningCampaign] = useState<BloodStockWarningItem | null>(null);
  const [warningCampaignMessage, setWarningCampaignMessage] = useState('');
  const [warningCampaignSending, setWarningCampaignSending] = useState(false);
  const [warningCampaignError, setWarningCampaignError] = useState('');
  const [warningCampaignSuccess, setWarningCampaignSuccess] = useState<{
    targetDonorCount: number;
    bloodGroup: BloodGroup;
    launchedAt: string;
  } | null>(null);
  const [actionCenterCollapsed, setActionCenterCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.localStorage.getItem(ACTION_CENTER_COLLAPSED_KEY) === 'true';
  });
  const actionCenterTriggerRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    const load = async () => {
      try {
        const [
          profileResult,
          inventoryResult,
          inventoryLogsResult,
          requestsResult,
          activeRequestsResult,
          activeRequestsSummaryResult,
          historyResult,
          todayAppointmentSummaryResult,
          availableDonorsResult,
          appointmentsResult,
          notificationsResult,
          stockWarningsResult,
          campaignsResult,
          stockTrendsResult,
        ] = await Promise.allSettled([
          getHospitalProfile(),
          getHospitalInventory(),
          getInventoryLogs({ skip: 0, take: 20 }),
          getHospitalRequests(),
          getHospitalActiveRequests({ skip: 0, take: 25 }),
          getHospitalActiveRequestSummary(),
          getHospitalRequestHistory({ skip: 0, take: 20 }),
          getHospitalAppointmentSummary(getTodayAppointmentQuery()),
          searchHospitalDonors({ availabilityFilter: 'AVAILABLE_ONLY' }),
          getHospitalAppointments(),
          getHospitalNotifications(),
          getBloodStockWarnings(),
          getMobilizationCampaigns(),
          getBloodStockTrends(30),
        ]);

        const loadedProfile = getSettledValue<HospitalProfile | null>(profileResult, null);
        const inventory = getSettledValue<InventoryItem[]>(inventoryResult, []);
        const inventoryLogs = getSettledValue<InventoryLogItem[]>(inventoryLogsResult, []);
        const requests = getSettledValue<BloodRequestItem[]>(requestsResult, []);
        const activeCoordinationItems = getSettledValue<BloodRequestItem[]>(activeRequestsResult, []);
        const activeRequestsSummary = getSettledValue<{ total: number }>(activeRequestsSummaryResult, { total: activeCoordinationItems.length });
        const requestHistory = getSettledValue<BloodRequestItem[]>(historyResult, []);
        const todayAppointmentSummary = getSettledValue<{ total: number }>(todayAppointmentSummaryResult, { total: 0 });
        const availableDonors = getSettledValue<{ summary: { totalMatches: number; availableCount: number } }>(availableDonorsResult, { summary: { totalMatches: 0, availableCount: 0 } });
        const appointments = getSettledValue<AppointmentItem[]>(appointmentsResult, []);
        const notifications = getSettledValue<NotificationItem[]>(notificationsResult, []);
        const warningItems = getSettledValue<BloodStockWarningItem[]>(stockWarningsResult, []);
        const campaignItems = getSettledValue<MobilizationCampaign[]>(campaignsResult, []);
        const trendItems = getSettledValue<BloodStockTrendResponse | null>(stockTrendsResult, null);
        const failedSections = [
          profileResult.status === 'rejected' ? 'profile' : null,
          inventoryResult.status === 'rejected' ? 'inventory' : null,
          inventoryLogsResult.status === 'rejected' ? 'inventory logs' : null,
          requestsResult.status === 'rejected' ? 'requests' : null,
          activeRequestsResult.status === 'rejected' ? 'active emergency requests' : null,
          activeRequestsSummaryResult.status === 'rejected' ? 'active request summary' : null,
          historyResult.status === 'rejected' ? 'request history' : null,
          todayAppointmentSummaryResult.status === 'rejected' ? 'today appointment summary' : null,
          availableDonorsResult.status === 'rejected' ? 'available approved donors' : null,
          appointmentsResult.status === 'rejected' ? 'appointments' : null,
          notificationsResult.status === 'rejected' ? 'notifications' : null,
          stockWarningsResult.status === 'rejected' ? 'stock early warning' : null,
          campaignsResult.status === 'rejected' ? 'mobilization campaigns' : null,
          stockTrendsResult.status === 'rejected' ? 'stock trends' : null,
        ].filter(Boolean);
        setLoadWarning(
          failedSections.length > 0
            ? `Some dashboard sections could not load: ${failedSections.join(', ')}.`
            : null,
        );

        setProfile(loadedProfile);
        setStockWarnings(warningItems);
        setActiveCoordinationRequests(activeCoordinationItems);
        setCampaigns(campaignItems);
        setStockTrends(trendItems);
        setLastAnalysisTime(trendItems?.generatedAt ? new Date(trendItems.generatedAt) : new Date());

        const stockItems = inventory.length > 0 ? inventory : (loadedProfile?.inventoryItems ?? []);
        setRequestItems(requests);
        setInventoryItems(stockItems);
        setStockUnits(stockItems.reduce((sum, item) => sum + Number(item.availableUnits ?? 0), 0));
        setActiveRequests(activeRequestsSummary.total);

        setTodayAppointments(todayAppointmentSummary.total);
        setAvailableApprovedDonors(availableDonors.summary.availableCount ?? availableDonors.summary.totalMatches);

        const topAlerts = notifications
          .slice(0, 3)
          .map((item) => `${item.title} (${formatDate(item.createdAt)})`);
        setAlerts(topAlerts);

        const approvalActivity = notifications
          .filter((item) => /approved|eligibility|review/i.test(`${item.title} ${item.body}`))
          .slice(0, 2)
          .map((item) => ({ id: `approval-${item.id}`, title: item.title, timestamp: item.createdAt }));
        const campaignNotificationActivity = notifications
          .filter((item) => item.campaignId && /mobilisation|mobilization|campaign/i.test(`${item.title} ${item.body}`))
          .slice(0, 3)
          .map((item) => ({ id: `campaign-${item.id}`, title: item.body || item.title, timestamp: item.createdAt }));
        const appointmentActivity = appointments
          .filter((item) => !item.donationPostedAt)
          .slice(0, 2)
          .map((item) => ({
            id: `appointment-${item.id}`,
            title: `${item.appointmentReference}: appointment ${formatStatusLabel(item.status)} for ${item.donor?.fullName ?? 'donor'}`,
            timestamp: item.completedAt ?? item.scheduledAt,
          }));
        const completedAppointmentActivity = appointments
          .filter((item) => item.status === 'COMPLETED')
          .slice(0, 2)
          .map((item) => ({
            id: `completed-${item.id}`,
            title: `Appointment completed: ${item.appointmentReference} for ${item.donor?.fullName ?? 'donor'}`,
            timestamp: item.completedAt ?? item.donationPostedAt ?? item.scheduledAt,
          }));
        const donationActivity = appointments
          .filter((item) => item.donationPostedAt)
          .slice(0, 4)
          .map((item) => {
            const units = item.unitsCollected ?? 1;
            const donor = item.donor?.fullName ?? 'Donor';
            const donationNumber = item.donationNumber ? ` (${item.donationNumber})` : '';
            return {
              id: `donation-${item.id}`,
              title: `Donation posted${donationNumber}: +${units} ${item.donor?.bloodGroup ? formatBloodGroup(item.donor.bloodGroup) : 'blood'} from ${donor}`,
              timestamp: item.donationPostedAt ?? item.completedAt,
            };
          });
        const inventoryActivity = inventoryLogs
          .slice(0, 2)
          .map((item) => ({
            id: `inventory-${item.id}`,
            title: `Inventory updated: ${formatBloodGroup(item.inventory.bloodGroup)} ${item.previousUnits} to ${item.newUnits}${item.reason ? ` (${item.reason})` : ''}`,
            timestamp: item.createdAt,
          }));
        const requestActivity = requests.slice(0, 4).map((item) => ({
          id: `request-${item.id}`,
          title: `${item.requestReference}: ${formatBloodGroup(item.bloodGroup)} request, ${item.unitsNeeded} units (${formatStatusLabel(item.status)}, ${formatStatusLabel(item.requestSource)})`,
          timestamp: item.createdAt,
        }));
        const transferActivity = requestHistory.flatMap((item) =>
          (item.hospitalResponses ?? []).flatMap((response) => {
            const entries: RecentActivityItem[] = [];
            if (response.status === 'ACCEPTED' || response.status === 'REJECTED') {
              entries.push({
                id: `offer-${response.id}`,
                title: `Hospital offer ${formatStatusLabel(response.status)}: ${item.requestReference}`,
                timestamp: response.updatedAt ?? response.createdAt,
              });
            }
            if (response.transfer?.dispatchedAt) {
              entries.push({
                id: `dispatch-${response.transfer.id}`,
                title: `Blood dispatched: ${item.requestReference}`,
                timestamp: response.transfer.dispatchedAt,
              });
            }
            if (response.transfer?.receivedAt) {
              entries.push({
                id: `received-${response.transfer.id}`,
                title: `Blood received: ${item.requestReference}`,
                timestamp: response.transfer.receivedAt,
              });
            }
            return entries;
          }),
        );
        const completedRequestActivity = requestHistory
          .filter((item) => item.status === 'FULFILLED' || item.status === 'CANCELLED')
          .slice(0, 4)
          .map((item) => ({
            id: `history-${item.id}`,
            title: `Emergency request ${formatStatusLabel(item.status)}: ${item.requestReference}`,
            timestamp: item.updates?.[0]?.createdAt ?? item.createdAt,
          }));
        setRecentActivity([
          ...completedAppointmentActivity,
          ...donationActivity,
          ...inventoryActivity,
          ...transferActivity,
          ...completedRequestActivity,
          ...appointmentActivity,
          ...campaignNotificationActivity,
          ...approvalActivity,
          ...requestActivity,
        ]
          .sort((a, b) => new Date(b.timestamp ?? 0).getTime() - new Date(a.timestamp ?? 0).getTime())
          .slice(0, 5));
      } finally {
        setLoading(false);
      }
    };

    void load();

    const socket = createRealtimeSocket();
    const refreshDashboard = () => {
      void load();
    };
    socket.on('emergency.request.updated', refreshDashboard);
    socket.on('notification.created', refreshDashboard);
    socket.on('inventory.updated', refreshDashboard);
    socket.on('appointment.updated', refreshDashboard);
    socket.on('donor.search.invalidated', refreshDashboard);
    socket.on('donor.response.updated', refreshDashboard);
    socket.on('donor.mobilization.response.updated', refreshDashboard);
    socket.on('hospital.map.updated', refreshDashboard);
    let localDayTimer: ReturnType<typeof window.setTimeout> | null = null;
    const scheduleLocalDayRefresh = () => {
      localDayTimer = window.setTimeout(() => {
        void load();
        scheduleLocalDayRefresh();
      }, getMsUntilNextLocalDay());
    };
    scheduleLocalDayRefresh();

    return () => {
      socket.off('emergency.request.updated', refreshDashboard);
      socket.off('notification.created', refreshDashboard);
      socket.off('inventory.updated', refreshDashboard);
      socket.off('appointment.updated', refreshDashboard);
      socket.off('donor.search.invalidated', refreshDashboard);
      socket.off('donor.response.updated', refreshDashboard);
      socket.off('donor.mobilization.response.updated', refreshDashboard);
      socket.off('hospital.map.updated', refreshDashboard);
      if (localDayTimer) {
        window.clearTimeout(localDayTimer);
      }
      socket.disconnect();
    };
  }, []);

  const criticalBloodGroups = stockWarnings.filter((item) => item.level === 'CRITICAL').length;
  const lowStockGroups = stockWarnings.filter((item) => item.level === 'WATCH' || item.level === 'LIKELY_SHORTAGE').length;
  const likelyShortageGroups = stockWarnings.filter((item) => item.level === 'LIKELY_SHORTAGE').length;
  const monitorBloodGroups = stockWarnings.filter((item) => item.level === 'WATCH').length;
  const stableBloodGroups = stockWarnings.filter((item) => item.level === 'STABLE').length;
  const activeCampaigns = campaigns.filter((item) => item.status === 'SENT').length;
  const expectedDonationUnits = campaigns.reduce((sum, item) => sum + item.donatedUnits, 0);
  const campaignSuccessRate = campaigns.length
    ? Math.round(campaigns.reduce((sum, item) => sum + item.donationSuccessRate, 0) / campaigns.length)
    : 0;
  const totalEligibleDonors = availableApprovedDonors;
  const bloodStatus = getHospitalBloodStatus(stockWarnings, requestItems, inventoryItems);
  const nextAnalysisTime = lastAnalysisTime ? addMinutes(lastAnalysisTime, 15) : null;
  const warningByBloodGroup = new Map(stockWarnings.map((item) => [item.bloodGroup, item]));
  const inventoryByBloodGroup = new Map(inventoryItems.map((item) => [item.bloodGroup, item]));
  const emergencyAlerts = stockWarnings.filter((item) => {
    const usable = getWarningUsableUnits(item);
    return item.level === 'CRITICAL' && usable <= 0;
  }).length;
  const activeInventoryAlerts = stockWarnings.filter((item) => item.level === 'LIKELY_SHORTAGE' || item.level === 'CRITICAL').length;
  const inventoryHealthRows = CORE_BLOOD_GROUPS.map((bloodGroup) => {
    const warning = warningByBloodGroup.get(bloodGroup);
    const inventoryItem = inventoryByBloodGroup.get(bloodGroup);
    const currentUnits = Number(warning?.currentUnits ?? inventoryItem?.availableUnits ?? 0);
    const averageDailyUsage = typeof warning?.averageDailyUsage === 'number' ? warning.averageDailyUsage : null;
    const expiringSoon = Number(warning?.expiringUnits ?? 0);
    const activeDemandUnits = Number(warning?.activeDemandUnits ?? 0);
    const scheduledDonationUnits = Number(warning?.scheduledDonationUnits ?? 0);
    const incomingTransferUnits = Number(warning?.incomingTransferUnits ?? 0);
    const exactAvailableDonors = Number(warning?.exactAvailableDonors ?? 0);
    const compatibleAvailableDonors = Number(warning?.compatibleAvailableDonors ?? warning?.eligibleDonorCount ?? 0);
    const riskScore = Number(warning?.riskScore ?? (currentUnits <= 0 ? 80 : 25));
    const level = warning?.level ?? (currentUnits <= 0 ? 'CRITICAL' : 'STABLE' as StockWarningLevel);
    return {
      bloodGroup,
      label: formatBloodGroup(bloodGroup),
      currentUnits,
      averageDailyUsage,
      expiringSoon,
      activeDemandUnits,
      scheduledDonationUnits,
      incomingTransferUnits,
      usableUnits: Number(warning?.usableUnits ?? Math.max(0, currentUnits - expiringSoon - activeDemandUnits)),
      exactAvailableDonors,
      compatibleAvailableDonors,
      eligibleDonorCount: compatibleAvailableDonors,
      level,
      status: warning?.status ?? getWarningLevelLabel(level),
      riskScore,
      riskLabel: warning?.riskLevel ?? getRiskLabel(riskScore),
      riskFactors: warning?.riskFactors ?? ['Current facts were evaluated by the backend inventory health rules.'],
      explanation: warning?.explanation ?? 'No backend inventory health record is available for this blood group.',
    };
  });
  const highestRiskRow = [...inventoryHealthRows].sort((a, b) => b.riskScore - a.riskScore)[0];
  const urgentStockItems = [...inventoryHealthRows]
    .filter((item) => item.level !== 'STABLE')
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 3);
  const urgentWarnings = [...stockWarnings]
    .filter((item) => item.level !== 'STABLE')
    .sort((first, second) => {
      const severity: Record<StockWarningLevel, number> = {
        CRITICAL: 0,
        LIKELY_SHORTAGE: 1,
        WATCH: 2,
        STABLE: 3,
      };
      return severity[first.level] - severity[second.level];
    });
  const activeEmergencyRequests = [...new Map([...activeCoordinationRequests, ...requestItems].map((item) => [item.id, item])).values()]
    .filter((request) =>
      request.type === 'EMERGENCY' &&
      ['CRITICAL', 'HIGH'].includes(request.priority) &&
      isActiveByFulfillment(request),
    )
    .sort((first, second) => {
      const priorityRank: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
      return (priorityRank[first.priority] ?? 9) - (priorityRank[second.priority] ?? 9)
        || new Date(first.requiredBy).getTime() - new Date(second.requiredBy).getTime()
        || new Date(second.createdAt).getTime() - new Date(first.createdAt).getTime();
    });
  const activeEmergencyRequest = activeEmergencyRequests[0] ?? null;
  const activeEmergencyBloodGroup = activeEmergencyRequest?.bloodGroup;
  const activeEmergencyBloodLabel = activeEmergencyBloodGroup ? formatBloodGroup(activeEmergencyBloodGroup) : '';
  const compatibleGroups = activeEmergencyBloodGroup ? getCompatibleDonorGroups(activeEmergencyBloodGroup) : [];
  const requestQuery = activeEmergencyRequest
    ? new URLSearchParams({
        requestId: activeEmergencyRequest.id,
        requestReference: activeEmergencyRequest.requestReference,
        bloodGroup: activeEmergencyRequest.bloodGroup,
        compatible: 'true',
        eligible: 'true',
        available: 'true',
        emergency: 'true',
        priority: activeEmergencyRequest.priority,
      }).toString()
    : '';
  const emergencyActions: EmergencyActionItem[] = activeEmergencyRequest
    ? [
        {
          id: 'notify-compatible-donors',
          label: `Notify compatible donors for ${activeEmergencyBloodLabel}`,
          description: `Use compatible groups: ${compatibleGroups.map(formatBloodGroup).join(', ') || activeEmergencyBloodLabel}.`,
          priority: 'Immediate',
          kind: 'link',
          to: `/hospital/donor-search?${requestQuery}&notify=1`,
          ariaLabel: `Notify compatible donors for ${activeEmergencyRequest.requestReference}`,
        },
        {
          id: 'launch-donor-mobilization-campaign',
          label: `Launch ${activeEmergencyBloodLabel} donor mobilization campaign`,
          description: `${activeEmergencyRequest.unitsNeeded} unit(s) needed by ${formatDateTime(activeEmergencyRequest.requiredBy)}.`,
          priority: activeEmergencyRequest.priority === 'CRITICAL' ? 'Critical' : 'High',
          kind: 'button',
          onClick: () => {
            setCampaignRequest(activeEmergencyRequest);
            setCampaignMessage(
              `Emergency donor mobilization: ${activeEmergencyRequest.hospital?.hospitalName ?? profile?.hospitalName ?? 'Hospital'} urgently needs ${activeEmergencyRequest.unitsNeeded} unit(s) of ${activeEmergencyBloodLabel} blood for ${activeEmergencyRequest.ward ?? 'the emergency unit'} by ${formatDateTime(activeEmergencyRequest.requiredBy)}. If eligible and available, please respond immediately.`,
            );
          },
          ariaLabel: `Launch donor mobilization campaign for ${activeEmergencyRequest.requestReference}`,
        },
        {
          id: 'check-nearby-blood-bank-availability',
          label: `Check nearby blood banks for compatible ${activeEmergencyBloodLabel} stock`,
          description: 'Open live map in emergency mode with this request context.',
          priority: 'Coordination',
          kind: 'link',
          to: `/hospital/live-map?${requestQuery}&groups=${compatibleGroups.join(',')}`,
          ariaLabel: `Check nearby blood bank availability for ${activeEmergencyRequest.requestReference}`,
        },
        {
          id: 'schedule-additional-donation-appointments',
          label: `Schedule additional ${activeEmergencyBloodLabel} donation appointments`,
          description: 'Open appointment scheduling with this emergency request attached.',
          priority: 'Capacity',
          kind: 'link',
          to: `/hospital/appointments?requestId=${activeEmergencyRequest.id}&requestReference=${encodeURIComponent(activeEmergencyRequest.requestReference)}&bloodGroup=${activeEmergencyRequest.bloodGroup}&mode=emergency`,
          ariaLabel: `Schedule additional donation appointments for ${activeEmergencyRequest.requestReference}`,
        },
        {
          id: 'view-compatible-donors',
          label: `View compatible donors for ${activeEmergencyBloodLabel}`,
          description: 'Review eligible available donors before sending alerts.',
          priority: 'Review',
          kind: 'link',
          to: `/hospital/donor-search?${requestQuery}`,
          ariaLabel: `View compatible donors for ${activeEmergencyRequest.requestReference}`,
        },
        {
          id: 'monitor-request-progress',
          label: `Monitor the progress of this ${activeEmergencyBloodLabel} request`,
          description: 'View responses, transfers, appointments, and fulfillment timeline.',
          priority: 'Tracking',
          kind: 'link',
          to: `/hospital/active-requests?requestId=${activeEmergencyRequest.id}`,
          ariaLabel: `Monitor request progress for ${activeEmergencyRequest.requestReference}`,
        },
      ]
    : [];
  const actionCount = emergencyActions.length;
  const compatibilityWarning = compatibilitySummary ? warningByBloodGroup.get(compatibilitySummary) : null;
  const launchMobilizationForWarning = async (item: BloodStockWarningItem) => {
    try {
      setMobilizationMessage('');
      const result = await mobilizeCompatibleDonors({
        bloodGroup: item.bloodGroup,
        warningLevel: item.level,
        forecastPeriodHours: item.forecastPeriodHours ?? 48,
        radiusKm: mobilizationPreviews[item.bloodGroup]?.radiusKm ?? 25,
      });
      setMobilizationMessage(result.message);
      setCompatibilitySummary(null);
    } catch (error: any) {
      const apiError = error?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setMobilizationMessage(extracted ?? 'Unable to notify compatible donors right now.');
    }
  };
  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(ACTION_CENTER_COLLAPSED_KEY, actionCenterCollapsed ? 'true' : 'false');
  }, [actionCenterCollapsed]);

  useEffect(() => {
    if (!activeEmergencyRequest || typeof window === 'undefined') return;
    const lastSeen = window.localStorage.getItem(ACTION_CENTER_LAST_SEEN_KEY);
    if (lastSeen !== activeEmergencyRequest.id && activeEmergencyRequest.priority === 'CRITICAL') {
      setActionCenterCollapsed(false);
      window.localStorage.setItem(ACTION_CENTER_LAST_SEEN_KEY, activeEmergencyRequest.id);
    }
  }, [activeEmergencyRequest?.id, activeEmergencyRequest?.priority]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && warningCampaign) {
        setWarningCampaign(null);
        return;
      }
      if (event.key === 'Escape' && campaignRequest) {
        setCampaignRequest(null);
        return;
      }
      if (event.key === 'Escape' && !actionCenterCollapsed && actionCount > 0) {
        setActionCenterCollapsed(true);
        window.setTimeout(() => actionCenterTriggerRef.current?.focus(), 0);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [actionCenterCollapsed, actionCount, campaignRequest, warningCampaign]);

  useEffect(() => {
    if ((!campaignRequest && !warningCampaign) || typeof document === 'undefined') return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [campaignRequest, warningCampaign]);

  const openWarningCampaign = (item: BloodStockWarningItem) => {
    const hospitalName = item.hospital?.hospitalName ?? profile?.hospitalName ?? 'Current hospital';
    setWarningCampaign(item);
    setWarningCampaignMessage(buildWarningCampaignMessage(hospitalName, item.bloodGroup));
    setWarningCampaignError('');
    setWarningCampaignSuccess(null);
  };

  const launchWarningCampaign = async () => {
    if (!warningCampaign || warningCampaignSending) return;
    const confirmed = window.confirm(
      `Launch donor mobilization campaign for ${formatBloodGroup(warningCampaign.bloodGroup)} compatible donors?`,
    );
    if (!confirmed) return;

    try {
      setWarningCampaignSending(true);
      setWarningCampaignError('');
      setWarningCampaignSuccess(null);
      const result = await mobilizeCompatibleDonors({
        bloodGroup: warningCampaign.bloodGroup,
        warningLevel: warningCampaign.level,
        forecastPeriodHours: warningCampaign.forecastPeriodHours ?? 48,
        radiusKm: DEFAULT_EMERGENCY_SEARCH_RADIUS_KM,
        message: warningCampaignMessage,
      });
      if (!result.success || result.targetedDonorCount === 0) {
        setWarningCampaignError(result.message || 'No eligible compatible donors matched the current campaign criteria.');
        return;
      }
      const launchedAt = new Date().toISOString();
      setWarningCampaignSuccess({
        targetDonorCount: result.notificationsCreated,
        bloodGroup: warningCampaign.bloodGroup,
        launchedAt,
      });
      setMobilizationMessage(`${result.message} ${result.notificationsCreated} notification(s) created. Campaign launched at ${formatDateTime(launchedAt)}.`);
    } catch (error: any) {
      const apiError = error?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setWarningCampaignError(extracted ?? 'Unable to launch donor mobilization campaign right now.');
    } finally {
      setWarningCampaignSending(false);
    }
  };

  const launchMobilizationForRequest = async () => {
    if (!campaignRequest) return;
    try {
      setCampaignSending(true);
      setMobilizationMessage('');
      const result = await mobilizeCompatibleDonors({
        bloodGroup: campaignRequest.bloodGroup,
        warningLevel: campaignRequest.priority === 'CRITICAL' ? 'CRITICAL' : 'LIKELY_SHORTAGE',
        forecastPeriodHours: 48,
        radiusKm: 25,
        message: campaignMessage,
      });
      setMobilizationMessage(`${result.message} Request: ${campaignRequest.requestReference}.`);
      setCampaignRequest(null);
      setCampaignMessage('');
    } catch (error: any) {
      const apiError = error?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setMobilizationMessage(extracted ?? 'Unable to launch donor mobilization campaign right now.');
    } finally {
      setCampaignSending(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        {profile ? (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-red-100 bg-red-50 px-4 py-3">
            <SmartAvatar name={profile.hospitalName} src={profile.logoUrl} size="md" />
            <div>
              <p className="text-sm font-black uppercase tracking-wide text-primary">{greeting()}</p>
              <p className="text-xl font-black text-slate-950">{formatHospitalDisplayName(profile.hospitalName)}</p>
              <p className="text-sm font-semibold text-muted">
                {[profile.city, profile.region].filter(Boolean).join(', ') || 'Facility location not recorded'}
              </p>
            </div>
          </div>
        ) : null}
        <h1 className="flex items-center gap-2 text-2xl font-bold text-primary">
          <AppIcon name="hospital" className="h-5 w-5" />
          Hospital Dashboard
        </h1>
        <p className="text-sm text-muted">Stock, active requests, activity, and alerts.</p>
        {loadWarning ? (
          <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            {loadWarning}
          </p>
        ) : null}
        {mobilizationMessage ? (
          <p className="mt-3 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
            {mobilizationMessage}
          </p>
        ) : null}
      </div>

      <section className={`rounded-3xl border p-5 shadow-sm ${bloodStatus.bannerClassName}`}>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-4">
            <span className={`mt-1 h-5 w-5 rounded-full shadow-lg ${bloodStatus.indicatorClassName}`} aria-hidden="true" />
            <div>
              <p className="text-xs font-black uppercase tracking-[0.3em] opacity-75">Hospital Blood Status</p>
              <h2 className="mt-2 text-3xl font-black uppercase tracking-wide">{loading ? 'Analyzing' : bloodStatus.title}</h2>
              <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 opacity-90">
                {loading ? 'Analyzing current blood inventory health...' : bloodStatus.message}
              </p>
            </div>
          </div>
          <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-3">
            <div className="rounded-2xl bg-white/70 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wide opacity-70">Healthy Blood Groups</p>
              <p className="mt-1 text-2xl font-black">{loading ? '...' : stableBloodGroups}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wide opacity-70">Low Stock Groups</p>
              <p className="mt-1 text-2xl font-black">{loading ? '...' : lowStockGroups}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wide opacity-70">Critical Groups</p>
              <p className="mt-1 text-2xl font-black">{loading ? '...' : criticalBloodGroups}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3">
              <p className="text-xs font-black uppercase tracking-wide opacity-70">Last Analysis</p>
              <p className="mt-1 text-sm font-black">{loading ? '...' : formatDateTime(lastAnalysisTime?.toISOString())}</p>
            </div>
            <div className="rounded-2xl bg-white/70 px-4 py-3 sm:col-span-2 xl:col-span-2">
              <p className="text-xs font-black uppercase tracking-wide opacity-70">Next Automatic Analysis</p>
              <p className="mt-1 text-sm font-black">{loading ? '...' : formatDateTime(nextAnalysisTime?.toISOString())}</p>
              <p className="mt-1 text-xs font-semibold opacity-70">Dashboard analysis refreshes on the next scheduled inventory polling cycle.</p>
            </div>
          </div>
        </div>
      </section>

      {actionCount > 0 && actionCenterCollapsed ? (
        <button
          ref={actionCenterTriggerRef}
          aria-label="Open Emergency Actions"
          aria-controls="hospital-emergency-action-center"
          aria-expanded={false}
          className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] right-5 z-[70] flex cursor-pointer items-center gap-2 rounded-full border border-red-200 bg-white px-4 py-3 text-sm font-black text-primary shadow-2xl shadow-red-950/15 transition hover:-translate-y-0.5 hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-200"
          onClick={() => setActionCenterCollapsed(false)}
          type="button"
        >
          <AppIcon name="alert" className="h-4 w-4" />
          Emergency Actions
          <span className="rounded-full bg-primary px-2 py-0.5 text-xs text-white">{actionCount}</span>
        </button>
      ) : null}

      {actionCount > 0 && !actionCenterCollapsed ? (
        <aside
          aria-label="Emergency Action Center"
          className="fixed inset-x-3 bottom-4 z-[70] max-h-[82vh] overflow-y-auto rounded-3xl border border-red-100 bg-white p-4 shadow-2xl shadow-red-950/15 sm:inset-x-auto sm:right-6 sm:top-28 sm:bottom-auto sm:max-h-[calc(100vh-145px)] sm:w-[380px] sm:max-w-[calc(100vw-48px)]"
          id="hospital-emergency-action-center"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Emergency Action Center</p>
              <h2 className="mt-1 text-lg font-black text-slate-950">
                {actionCount > 0
                  ? `${actionCount} Recommended Action${actionCount === 1 ? '' : 's'}`
                  : 'No Immediate Actions Required'}
              </h2>
              {activeEmergencyRequest ? (
                <p className="mt-1 text-xs font-bold text-muted">
                  {activeEmergencyRequest.requestReference} - {activeEmergencyBloodLabel} - {activeEmergencyRequest.priority}
                </p>
              ) : null}
            </div>
            <button
              aria-label="Close Emergency Action Center"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-red-200"
              onClick={() => {
                setActionCenterCollapsed(true);
                window.setTimeout(() => actionCenterTriggerRef.current?.focus(), 0);
              }}
              type="button"
            >
              Close
            </button>
          </div>
          <div className="mt-4 space-y-2">
            {emergencyActions.map((action, index) => {
            const content = (
              <>
                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-black text-white">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-slate-900">{action.label}</span>
                  <span className="mt-0.5 block text-xs font-medium leading-5 text-slate-500">{action.description}</span>
                  <span className="block text-xs font-semibold text-muted">{action.priority}</span>
                </span>
              </>
            );

            if (action.kind === 'button') {
              return (
                <button
                  key={action.id}
                  aria-label={action.ariaLabel}
                  className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-primary hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"
                  onClick={action.onClick}
                  type="button"
                >
                  {content}
                </button>
              );
            }

            return (
              <Link
                key={action.id}
                aria-label={action.ariaLabel}
                className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-left transition hover:border-primary hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"
                to={action.to ?? '/hospital/dashboard'}
              >
                {content}
              </Link>
            );
          })}
          </div>
          <p className="mt-4 rounded-2xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
            Actions use the active request as source of truth. Donor contact and campaign delivery remain protected by backend permissions.
          </p>
        </aside>
      ) : null}

      {campaignRequest ? (
        <section
          aria-labelledby="donor-mobilization-title"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">
                  Donor Mobilization Campaign
                </p>
                <h2 id="donor-mobilization-title" className="mt-1 text-xl font-black text-slate-950">
                  Launch campaign for {campaignRequest.requestReference}
                </h2>
                <p className="mt-1 text-sm font-semibold text-muted">
                {formatBloodGroup(campaignRequest.bloodGroup)} - {campaignRequest.unitsNeeded} unit(s) - {formatStatusLabel(campaignRequest.priority)}
                </p>
              </div>
              <button
                aria-label="Close donor mobilization campaign"
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-red-100"
                onClick={() => setCampaignRequest(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-2 rounded-2xl bg-red-50 p-3 text-sm text-red-950">
              <p>
                <strong>Hospital:</strong>{' '}
                {campaignRequest.hospital?.hospitalName ?? profile?.hospitalName ?? 'Current hospital'}
              </p>
              <p>
                <strong>Required by:</strong> {formatDateTime(campaignRequest.requiredBy)}
              </p>
              <p>
                <strong>Ward / Unit:</strong> {campaignRequest.ward ?? 'Emergency unit'}
              </p>
              <p>
                <strong>Location:</strong> {campaignRequest.emergencyLocation ?? campaignRequest.location}
              </p>
              <p>
                <strong>Compatible groups:</strong>{' '}
                {getCompatibleDonorGroups(campaignRequest.bloodGroup).map(formatBloodGroup).join(', ') || 'Not available'}
              </p>
              <p className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold">
                Delivery uses the existing donor mobilization service. Donor contact remains protected by backend permissions.
              </p>
            </div>

            <label className="mt-4 block text-sm font-bold text-slate-900">
              Campaign message
              <textarea
                className="legacy-input mt-2 min-h-32"
                onChange={(event) => setCampaignMessage(event.target.value)}
                value={campaignMessage}
              />
            </label>

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50"
                onClick={() => setCampaignRequest(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={campaignSending || !campaignMessage.trim()}
                onClick={() => void launchMobilizationForRequest()}
                type="button"
              >
                {campaignSending ? 'Launching...' : 'Launch Campaign'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {warningCampaign ? (
        <section
          aria-labelledby="early-warning-campaign-title"
          aria-modal="true"
          className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/45 px-4 py-6"
          role="dialog"
        >
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">
                  Donor Mobilization Campaign
                </p>
                <h2 id="early-warning-campaign-title" className="mt-1 text-xl font-black text-slate-950">
                  Launch campaign for {formatBloodGroup(warningCampaign.bloodGroup)} shortage
                </h2>
                <p className="mt-1 text-sm font-semibold text-muted">
                  Review the prefilled campaign details before notifying compatible donors.
                </p>
              </div>
              <button
                aria-label="Close early warning donor mobilization campaign"
                className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-600 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-red-100"
                disabled={warningCampaignSending}
                onClick={() => setWarningCampaign(null)}
                type="button"
              >
                Close
              </button>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl bg-red-50 p-3 text-sm text-red-950 sm:grid-cols-2">
              <p>
                <strong>Hospital:</strong>{' '}
                {warningCampaign.hospital?.hospitalName ?? profile?.hospitalName ?? 'Current hospital'}
              </p>
              <p>
                <strong>Blood Group:</strong> {formatBloodGroup(warningCampaign.bloodGroup)}
              </p>
              <p>
                <strong>Current units:</strong> {warningCampaign.currentUnits}
              </p>
              <p>
                <strong>Usable units:</strong> {getWarningUsableUnits(warningCampaign)}
              </p>
              <p>
                <strong>Stock status:</strong> {getWarningLevelLabel(warningCampaign.level)}
              </p>
              <p>
                <strong>Forecasted available:</strong>{' '}
                {warningCampaign.forecastedAvailableUnits ?? getWarningUsableUnits(warningCampaign)}
              </p>
              <p>
                <strong>Mobilizable donors:</strong>{' '}
                {warningCampaign.exactAvailableDonors ?? 0} exact / {warningCampaign.compatibleAvailableDonors ?? warningCampaign.eligibleDonorCount ?? 0} compatible
              </p>
              <p>
                <strong>Recommended action:</strong>{' '}
                {warningCampaign.recommendedActionType ?? 'Launch Proactive Donor Campaign'}
              </p>
              <p className="sm:col-span-2">
                <strong>Compatible groups:</strong>{' '}
                {getCompatibleDonorGroups(warningCampaign.bloodGroup).map(formatBloodGroup).join(', ') || 'Not available'}
              </p>
              <p className="rounded-xl bg-white/70 px-3 py-2 text-xs font-bold sm:col-span-2">
                Channels: SMS is attempted first for consenting donors with valid phone numbers. In-app notifications are always recorded.
              </p>
            </div>

            <p className="mt-3 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm font-semibold text-blue-800">
              Donor mobilisation alerts eligible donors. It does not notify other hospitals unless an inter-hospital request is also created.
            </p>

            <label className="mt-4 block text-sm font-bold text-slate-900">
              Campaign message
              <textarea
                className="legacy-input mt-2 min-h-32"
                disabled={warningCampaignSending}
                onChange={(event) => setWarningCampaignMessage(event.target.value)}
                value={warningCampaignMessage}
              />
            </label>

            {warningCampaignError ? (
              <p className="mt-3 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-bold text-red-700">
                {warningCampaignError}
              </p>
            ) : null}
            {warningCampaignSuccess ? (
              <div className="mt-3 rounded-xl border border-green-100 bg-green-50 px-3 py-2 text-sm text-green-800">
                <p className="font-black">Campaign launched</p>
                <p>
                  {warningCampaignSuccess.targetDonorCount} compatible donor(s) targeted for{' '}
                  {formatBloodGroup(warningCampaignSuccess.bloodGroup)} at {formatDateTime(warningCampaignSuccess.launchedAt)}.
                </p>
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700 transition hover:bg-slate-50 focus:outline-none focus:ring-4 focus:ring-red-100 disabled:cursor-not-allowed disabled:opacity-60"
                disabled={warningCampaignSending}
                onClick={() => setWarningCampaign(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                aria-label={`Launch campaign for ${formatBloodGroup(warningCampaign.bloodGroup)} compatible donors`}
                className="btn-primary px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                disabled={
                  warningCampaignSending ||
                  !warningCampaignMessage.trim() ||
                  Boolean(warningCampaignSuccess) ||
                  (warningCampaign.compatibleAvailableDonors ?? warningCampaign.eligibleDonorCount ?? 0) <= 0
                }
                onClick={() => void launchWarningCampaign()}
                type="button"
              >
                {(warningCampaign.compatibleAvailableDonors ?? warningCampaign.eligibleDonorCount ?? 0) <= 0
                  ? 'No Mobilizable Donors'
                  : warningCampaignSending
                    ? 'Launching...'
                    : 'Confirm and Launch Campaign'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {compatibilitySummary ? (
        <section className="rounded-3xl border border-blue-200 bg-blue-50 p-5 shadow-sm">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.25em] text-blue-700">Compatibility Summary</p>
              <h2 className="mt-2 text-xl font-black text-blue-950">
                Blood Needed: {formatBloodGroup(compatibilitySummary)}
              </h2>
              <p className="mt-2 text-sm font-semibold text-blue-900">
                Compatible Donor Groups: {getCompatibleDonorGroups(compatibilitySummary).map(formatBloodGroup).join(', ') || 'Not available'}
              </p>
              <p className="mt-2 text-sm text-blue-900">
                The search is using compatible donor mode rather than exact blood-group matching.
              </p>
              <p className="mt-2 rounded-2xl bg-white/70 px-3 py-2 text-xs font-bold text-blue-900">
                Final transfusion decisions must follow hospital clinical procedures and crossmatching requirements.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {compatibilityWarning ? (
                <button
                  className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-white"
                  onClick={() => void launchMobilizationForWarning(compatibilityWarning)}
                  type="button"
                >
                  Notify Compatible Donors
                </button>
              ) : null}
              <Link
                className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-800"
                to="/hospital/donor-search"
              >
                View Compatible Donors
              </Link>
              <button
                className="rounded-xl border border-blue-200 bg-white px-4 py-2 text-sm font-black text-blue-800"
                onClick={() => setCompatibilitySummary(null)}
                type="button"
              >
                Close
              </button>
            </div>
          </div>
        </section>
      ) : null}

      {highestRiskRow ? (
        <section>
          <article className="rounded-3xl border border-red-100 bg-white p-5 shadow-sm">
            <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Today's Hospital Recommendation</p>
            <h2 className="mt-2 text-2xl font-black text-slate-950">
              {highestRiskRow.riskScore > 0
                ? `${highestRiskRow.label} requires priority monitoring`
                : 'No high-risk blood group detected'}
            </h2>
            <p className="mt-2 text-sm font-semibold text-muted">
              Risk Score: <span className="text-primary">{highestRiskRow.riskScore}/100</span> - {highestRiskRow.riskLabel}
            </p>
            <p className="mt-2 text-sm text-slate-700">
              {`${highestRiskRow.label} currently has ${highestRiskRow.usableUnits} usable unit(s), ${highestRiskRow.activeDemandUnits} unit(s) in active emergency demand, and ${highestRiskRow.compatibleAvailableDonors} compatible mobilizable donor(s).`}
            </p>
            <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              Main reason: {formatRiskReason(highestRiskRow.riskFactors[0])}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-primary px-4 py-2 text-sm font-black text-white"
                onClick={() => setCompatibilitySummary(highestRiskRow.bloodGroup)}
                type="button"
              >
                Notify nearby approved donors
              </button>
              <Link className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700" to="/hospital/live-map">
                Check nearby blood banks
              </Link>
              <Link className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700" to="/hospital/active-requests">
                Review active requests
              </Link>
              <Link className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-black text-slate-700" to="/hospital/appointments">
                Increase appointments
              </Link>
            </div>
          </article>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        <Link
          aria-label="Open hospital inventory"
          className={SUMMARY_CARD_CLASS}
          to="/hospital/inventory"
        >
          <p className="text-sm font-semibold text-muted">Total Blood Units</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : stockUnits}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Current available units in hospital inventory.</p>
        </Link>
        <Link
          aria-label="View active blood requests"
          className={SUMMARY_CARD_CLASS}
          to="/hospital/active-requests?filter=active"
        >
          <p className="text-sm font-semibold text-muted">Active Requests</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : activeRequests}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Open and matching coordination requests.</p>
        </Link>
        <Link
          aria-label="Open today's appointments"
          className={SUMMARY_CARD_CLASS}
          to="/hospital/appointments?dateFilter=today"
        >
          <p className="text-sm font-semibold text-muted">Today Appointments</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : todayAppointments}</p>
        </Link>
        <Link
          aria-label="View critical blood groups"
          className={SUMMARY_CARD_CLASS}
          to="/hospital/stock-intelligence?tab=risk-alerts&riskLevel=critical"
        >
          <p className="text-sm font-semibold text-orange-700">Critical Groups</p>
          <p className="mt-2 text-3xl font-black text-orange-700">{loading ? '...' : criticalBloodGroups}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Critical Stock Intelligence risk alerts.</p>
        </Link>
        <Link
          aria-label="View approved available donors"
          className={SUMMARY_CARD_CLASS}
          to="/hospital/donor-search?available=true&eligible=true&approval=approved"
        >
          <p className="text-sm font-semibold text-muted">Available Approved Donors</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : totalEligibleDonors}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Approved donors currently eligible and available.</p>
        </Link>
        <Link
          aria-label="View blood units expiring soon"
          className={SUMMARY_CARD_CLASS}
          to="/hospital/inventory?filter=expiring-soon"
        >
          <p className="text-sm font-semibold text-muted">Expiring Units</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : inventoryHealthRows.reduce((sum, item) => sum + item.expiringSoon, 0)}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Units marked as expiring soon by inventory warnings.</p>
        </Link>
      </div>

      <section className="card">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-primary">Urgent Stock Attention</h2>
            <p className="text-sm text-muted">Highest-priority blood groups only. Detailed analysis is under Stock Intelligence.</p>
          </div>
          <Link className="rounded-xl border border-primary px-3 py-2 text-xs font-black text-primary" to="/hospital/stock-intelligence">
            View All Stock Intelligence
          </Link>
        </div>
        {urgentStockItems.length === 0 ? (
          <p className="mt-3 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-800">
            No urgent stock items require attention right now.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-3">
            {urgentStockItems.map((item) => (
              <article key={`urgent-${item.bloodGroup}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-xl font-black text-slate-950">{item.label}</h3>
                    <p className="mt-1 text-sm font-semibold text-slate-600">{item.usableUnits} usable unit(s)</p>
                  </div>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${getWarningLevelClassName(item.level)}`}>
                    {getWarningLevelLabel(item.level)}
                  </span>
                </div>
                <p className="mt-3 text-sm text-slate-700">{formatRiskReason(item.riskFactors[0])}</p>
                <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                  {item.explanation}
                </p>
                <Link
                  className="mt-3 inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-black text-white"
                  to={`/hospital/stock-intelligence?tab=early-warnings&bloodGroup=${item.bloodGroup}&focus=donor-action`}
                >
                  View Details
                </Link>
              </article>
            ))}
          </div>
        )}
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No recent activity yet. Emergency requests, stock alerts, and appointment updates will appear here.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {recentActivity.map((item) => (
                <li key={item.id} className="rounded border border-gray-200 p-2">
                  <p className="font-semibold text-slate-800">{item.title}</p>
                  <p className="mt-1 text-xs text-muted">{formatDateTime(item.timestamp)}</p>
                </li>
              ))}
            </ul>
          )}
          <Link className="mt-3 inline-flex rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" to="/hospital/reports">
            View All Activity
          </Link>
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Alerts</h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No alerts right now. Critical stock warnings and emergency notifications will appear here.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {alerts.map((item) => (
                <li key={item} className="rounded border border-red-200 bg-red-50 p-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
          <Link className="mt-3 inline-flex rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" to="/hospital/notifications">
            View All Notifications
          </Link>
        </article>
      </div>
    </section>
  );
}


