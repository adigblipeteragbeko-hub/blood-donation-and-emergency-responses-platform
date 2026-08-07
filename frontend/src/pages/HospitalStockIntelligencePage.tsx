import { useEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
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
  getHospitalAppointments,
  getHospitalInventory,
  getInventoryLogs,
  getHospitalProfile,
  getHospitalNotifications,
  getHospitalRequests,
  getHospitalActiveRequests,
  getHospitalRequestHistory,
} from '../services/hospital-portal';
import { AppIcon } from '../components/ui/AppIcon';
import { SmartAvatar } from '../components/SmartAvatar';
import { createRealtimeSocket } from '../services/live-map';
import { formatHospitalDisplayName } from '../utils/hospital-display';

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

const CORE_BLOOD_GROUPS: BloodGroup[] = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'];

const getSettledValue = <T,>(result: PromiseSettledResult<T>, fallback: T): T =>
  result.status === 'fulfilled' ? result.value : fallback;

const isToday = (value?: string | null) => {
  if (!value) {
    return false;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return false;
  }
  const today = new Date();
  return (
    date.getFullYear() === today.getFullYear()
    && date.getMonth() === today.getMonth()
    && date.getDate() === today.getDate()
  );
};

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
  if (currentUnits <= 5 || item.level === 'CRITICAL') {
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

const stockRiskDetail = (reason?: string) => {
  const stockRisk = reason?.match(/stock level risk:\s*(\d+)\s*\/\s*40/i);
  if (!stockRisk) return null;
  const value = Number(stockRisk[1]);
  const explanation = value >= 40
    ? 'The system assigns up to 40 risk points based on current stock. A score of 40 means the blood group is at or below the critical stock threshold.'
    : value >= 20
      ? 'The system assigns up to 40 risk points based on current stock. This value means stock is approaching the minimum threshold.'
      : 'The system assigns up to 40 risk points based on current stock. This value means stock is currently above the minimum threshold.';
  return { label: `Stock-level risk: ${value >= 40 ? 'Maximum' : value === 0 ? 'Low' : 'Elevated'} (${value} of 40 points)`, explanation };
};

const addMinutes = (value: Date, minutes: number) => {
  const next = new Date(value);
  next.setMinutes(next.getMinutes() + minutes);
  return next;
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

export default function HospitalStockIntelligencePage() {
  const [searchParams] = useSearchParams();
  const initialRiskLevel = searchParams.get('riskLevel')?.toLowerCase() === 'critical' ? 'CRITICAL' : 'ALL';
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [stockUnits, setStockUnits] = useState(0);
  const [activeRequests, setActiveRequests] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
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
  const [riskLevelFilter, setRiskLevelFilter] = useState<'ALL' | StockWarningLevel>(initialRiskLevel);
  const [highlightedBloodGroup, setHighlightedBloodGroup] = useState<BloodGroup | null>(null);
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
          historyResult,
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
          getHospitalRequestHistory({ skip: 0, take: 20 }),
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
        const requestHistory = getSettledValue<BloodRequestItem[]>(historyResult, []);
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
          historyResult.status === 'rejected' ? 'request history' : null,
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
        setActiveRequests(requests.filter(isActiveByFulfillment).length);

        setTodayAppointments(
          appointments.filter((item) => isToday(item.scheduledAt) || isToday(item.completedAt)).length,
        );

        const topAlerts = notifications
          .slice(0, 4)
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
            title: `${item.appointmentReference}: appointment ${item.status.toLowerCase()} for ${item.donor?.fullName ?? 'donor'}`,
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
              title: `Donation posted${donationNumber}: +${units} ${item.donor?.bloodGroup ?? 'blood'} from ${donor}`,
              timestamp: item.donationPostedAt ?? item.completedAt,
            };
          });
        const inventoryActivity = inventoryLogs
          .slice(0, 2)
          .map((item) => ({
            id: `inventory-${item.id}`,
            title: `Inventory updated: ${item.inventory.bloodGroup} ${item.previousUnits} to ${item.newUnits}${item.reason ? ` (${item.reason})` : ''}`,
            timestamp: item.createdAt,
          }));
        const requestActivity = requests.slice(0, 4).map((item) => ({
          id: `request-${item.id}`,
          title: `${item.requestReference}: ${item.bloodGroup} request, ${item.unitsNeeded} units (${item.status}, ${item.requestSource})`,
          timestamp: item.createdAt,
        }));
        const transferActivity = requestHistory.flatMap((item) =>
          (item.hospitalResponses ?? []).flatMap((response) => {
            const entries: RecentActivityItem[] = [];
            if (response.status === 'ACCEPTED' || response.status === 'REJECTED') {
              entries.push({
                id: `offer-${response.id}`,
                title: `Hospital offer ${response.status.toLowerCase()}: ${item.requestReference}`,
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
            title: `Emergency request ${item.status.toLowerCase()}: ${item.requestReference}`,
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
          .slice(0, 8));
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

    return () => {
      socket.off('emergency.request.updated', refreshDashboard);
      socket.off('notification.created', refreshDashboard);
      socket.off('inventory.updated', refreshDashboard);
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
  const totalEligibleDonors = stockWarnings.reduce((sum, item) => sum + Number(item.compatibleAvailableDonors ?? item.eligibleDonorCount ?? 0), 0);
  const bloodStatus = getHospitalBloodStatus(stockWarnings, requestItems, inventoryItems);
  const nextAnalysisTime = lastAnalysisTime ? addMinutes(lastAnalysisTime, 15) : null;
  const warningByBloodGroup = new Map(stockWarnings.map((item) => [item.bloodGroup, item]));
  const inventoryByBloodGroup = new Map(inventoryItems.map((item) => [item.bloodGroup, item]));
  const riskAlertItems = stockWarnings.filter((item) => item.level !== 'STABLE');
  const filteredRiskAlertItems = riskLevelFilter === 'ALL'
    ? riskAlertItems
    : riskAlertItems.filter((item) => item.level === riskLevelFilter);
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
  const inventoryChartData = inventoryHealthRows.map((item) => ({
    bloodGroup: item.label,
    currentUnits: item.currentUnits,
    expiringSoon: item.expiringSoon,
    activeDemand: item.activeDemandUnits,
  }));
  const riskChartData = inventoryHealthRows.map((item) => ({
    bloodGroup: item.label,
    riskScore: item.riskScore,
    eligibleDonors: item.eligibleDonorCount,
  }));
  const usageTrendData = stockTrends?.trends
    .flatMap((trend) => trend.points.map((point) => ({ ...point, bloodGroup: formatBloodGroup(trend.bloodGroup) })))
    .slice(-14) ?? [];
  const emergencyVsInventoryData = inventoryHealthRows.map((item) => ({
    bloodGroup: item.label,
    inventory: item.currentUnits,
    emergencyDemand: item.activeDemandUnits,
  }));
  const highestRiskRow = [...inventoryHealthRows].sort((a, b) => b.riskScore - a.riskScore)[0];
  const operationalPriorities = [...inventoryHealthRows]
    .filter((item) => item.riskScore > 0 || item.level !== 'STABLE')
    .sort((a, b) =>
      b.riskScore - a.riskScore
      || b.activeDemandUnits - a.activeDemandUnits
      || b.expiringSoon - a.expiringSoon
      || a.eligibleDonorCount - b.eligibleDonorCount,
    )
    .slice(0, 4);
  const recommendationItems = stockWarnings
    .filter((item) => item.level !== 'STABLE')
    .slice(0, 5);
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
              `Emergency donor mobilization: ${formatHospitalDisplayName(activeEmergencyRequest.hospital?.hospitalName ?? profile?.hospitalName ?? 'Hospital')} urgently needs ${activeEmergencyRequest.unitsNeeded} unit(s) of ${activeEmergencyBloodLabel} blood for ${activeEmergencyRequest.ward ?? 'the emergency unit'} by ${formatDateTime(activeEmergencyRequest.requiredBy)}. If eligible and available, please respond immediately.`,
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

  useEffect(() => {
    if (loading) return;
    if (searchParams.get('riskLevel')?.toLowerCase() === 'critical') {
      setRiskLevelFilter('CRITICAL');
    }
    if (searchParams.get('tab') === 'risk-alerts') {
      window.setTimeout(() => {
        const target = document.getElementById('risk-alerts');
        if (!(target instanceof HTMLElement)) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        target.focus({ preventScroll: true });
      }, 120);
    }
    const bloodGroup = searchParams.get('bloodGroup') as BloodGroup | null;
    const focus = searchParams.get('focus');
    if (!bloodGroup || focus !== 'donor-action') return;
    setExpandedWarnings((previous) => ({ ...previous, [bloodGroup]: true }));
    window.setTimeout(() => {
      const target = document.getElementById(`early-warning-${bloodGroup}`) ?? document.querySelector(`[data-blood-group="${bloodGroup}"]`);
      if (!(target instanceof HTMLElement)) return;
      setHighlightedBloodGroup(bloodGroup);
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      target.focus({ preventScroll: true });
      window.setTimeout(() => setHighlightedBloodGroup(null), 2600);
    }, 120);
  }, [loading, searchParams, stockWarnings.length]);

  const openWarningCampaign = (item: BloodStockWarningItem) => {
    const hospitalName = formatHospitalDisplayName(item.hospital?.hospitalName ?? profile?.hospitalName ?? 'Current hospital');
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
          Stock Intelligence
        </h1>
        <p className="text-sm text-muted">
          Detailed inventory risks, early warnings, blood-group analysis, priorities, and historical stock trends for the hospital.
        </p>
        <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-900">
          Stock intelligence supports operational decision-making. Hospital Admin users remain responsible for reviewing and confirming all actions.
        </p>
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

      <section className="card">
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-sm font-bold text-slate-700">
            Blood Group
            <select className="mt-1 w-full rounded border border-slate-200 px-3 py-2">
              <option>All Blood Groups</option>
              {CORE_BLOOD_GROUPS.map((group) => <option key={group}>{formatBloodGroup(group)}</option>)}
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Risk Level
            <select
              className="mt-1 w-full rounded border border-slate-200 px-3 py-2"
              value={riskLevelFilter}
              onChange={(event) => setRiskLevelFilter(event.target.value as 'ALL' | StockWarningLevel)}
            >
              <option value="ALL">All Levels</option>
              <option value="STABLE">Healthy</option>
              <option value="WATCH">Monitor</option>
              <option value="LIKELY_SHORTAGE">Low Stock</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </label>
          <label className="text-sm font-bold text-slate-700">
            Date Range
            <select className="mt-1 w-full rounded border border-slate-200 px-3 py-2">
              <option>Last 30 Days</option>
              <option>Last 7 Days</option>
              <option>Last 90 Days</option>
              <option>Custom</option>
            </select>
          </label>
          <button className="btn-secondary" type="button" onClick={() => window.location.reload()}>
            Refresh Intelligence
          </button>
        </div>
        <nav className="mt-4 flex gap-2 overflow-x-auto" aria-label="Stock intelligence sections">
          {[
            ['Overview', '#stock-overview'],
            ['Priorities', '#stock-priorities'],
            ['Risk Alerts', '#risk-alerts'],
            ['Charts', '#stock-charts'],
            ['Early Warnings', '#early-warnings'],
            ['Historical Trends', '#historical-trends'],
          ].map(([label, href]) => (
            <a key={href} className="shrink-0 rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:border-primary hover:text-primary" href={href}>
              {label}
            </a>
          ))}
        </nav>
      </section>

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
                  {formatBloodGroup(campaignRequest.bloodGroup)} - {campaignRequest.unitsNeeded} unit(s) - {campaignRequest.priority}
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
                {formatHospitalDisplayName(campaignRequest.hospital?.hospitalName ?? profile?.hospitalName ?? 'Current hospital')}
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
                {formatHospitalDisplayName(warningCampaign.hospital?.hospitalName ?? profile?.hospitalName ?? 'Current hospital')}
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
                <strong>Risk level:</strong> {getWarningLevelLabel(warningCampaign.level)}
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
                disabled={warningCampaignSending || !warningCampaignMessage.trim() || Boolean(warningCampaignSuccess)}
                onClick={() => void launchWarningCampaign()}
                type="button"
              >
                {warningCampaignSending ? 'Launching...' : 'Confirm and Launch Campaign'}
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section id="stock-overview" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-24">
        <p className="text-xs font-black uppercase tracking-[0.3em] text-primary">Decision Support Dashboard</p>
        <h2 className="mt-2 text-2xl font-black text-slate-950">
          Blood Stock Early Warning & Proactive Donor Mobilization
        </h2>
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-6 text-muted">
          Monitor operational inventory health and proactively mobilize donors when current stock, expiry, demand, or donor coverage requires attention.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-sm">
          <span className={`rounded-full px-3 py-1 text-xs font-black ${getFreshnessClassName(lastAnalysisTime)}`}>
            {lastAnalysisTime && Date.now() - lastAnalysisTime.getTime() <= 5 * 60000 ? 'Live / Recent' : 'Needs Refresh Check'}
          </span>
          <span className="font-semibold text-slate-700">{formatRelativeTime(lastAnalysisTime)}</span>
          <span className="text-muted">Next scheduled analysis: {formatDateTime(nextAnalysisTime?.toISOString())}</span>
          <span className="text-muted">Dashboard analysis refreshed on page load.</span>
        </div>
      </section>

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
        <section className="grid gap-4 xl:grid-cols-[1fr_1fr]">
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
              {`${highestRiskRow.label} currently has ${highestRiskRow.usableUnits} usable unit(s), ${highestRiskRow.activeDemandUnits} unit(s) in active emergency demand, and ${highestRiskRow.compatibleAvailableDonors} compatible donor(s) available.`}
            </p>
            <p className="mt-2 rounded-2xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
              Main reason: {formatRiskReason(highestRiskRow.riskFactors[0])}
            </p>
            {stockRiskDetail(highestRiskRow.riskFactors[0]) ? (
              <details className="mt-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700">
                <summary className="font-black text-slate-900">What does the stock-risk score mean?</summary>
                <p className="mt-2 font-semibold">{stockRiskDetail(highestRiskRow.riskFactors[0])?.label}</p>
                <p className="mt-1">{stockRiskDetail(highestRiskRow.riskFactors[0])?.explanation}</p>
              </details>
            ) : null}
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

          <article id="stock-priorities" className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm scroll-mt-24">
            <h2 className="text-lg font-bold text-primary">Current Operational Priorities</h2>
            {operationalPriorities.length === 0 ? (
              <p className="mt-3 text-sm text-muted">No operational priorities require attention right now.</p>
            ) : (
              <div className="mt-3 space-y-3">
                {operationalPriorities.map((item, index) => (
                  <div key={`priority-${item.bloodGroup}`} className="rounded-2xl border border-slate-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-black text-slate-950">
                        {index + 1}. {item.riskScore >= 50 ? `Prevent ${item.label} shortage` : `Monitor ${item.label} stock`}
                      </p>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black ${getRiskClassName(item.riskScore)}`}>
                        {item.riskScore}/100 - {item.riskLabel}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-slate-600">{formatRiskReason(item.riskFactors[0])}</p>
                    {stockRiskDetail(item.riskFactors[0]) ? (
                      <p className="mt-2 rounded-xl bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                        {stockRiskDetail(item.riskFactors[0])?.label}
                      </p>
                    ) : null}
                    <Link
                      className="mt-3 inline-flex rounded-xl border border-primary px-3 py-2 text-xs font-black text-primary"
                      to={`/hospital/stock-intelligence?tab=early-warnings&bloodGroup=${item.bloodGroup}&focus=donor-action`}
                    >
                      Review donor action
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </article>
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="card">
          <p className="text-sm font-semibold text-muted">Blood Units In Stock</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : stockUnits}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Active Requests</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : activeRequests}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Today Appointments</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : todayAppointments}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Alerts</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : alerts.length}</p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <article className="card border-red-100 bg-red-50">
          <p className="text-sm font-semibold text-red-700">Emergency Alerts</p>
          <p className="mt-2 text-3xl font-black text-red-700">{loading ? '...' : emergencyAlerts}</p>
          <p className="mt-1 text-xs font-semibold text-red-700">Critical groups with no usable operational buffer.</p>
        </article>
        <article className="card border-amber-100 bg-amber-50">
          <p className="text-sm font-semibold text-amber-700">Inventory Alerts</p>
          <p className="mt-2 text-3xl font-black text-amber-700">{loading ? '...' : activeInventoryAlerts}</p>
          <p className="mt-1 text-xs font-semibold text-amber-700">Low or critical groups needing attention.</p>
        </article>
        <article className="card border-green-100 bg-green-50">
          <p className="text-sm font-semibold text-green-700">Healthy Blood Groups</p>
          <p className="mt-2 text-3xl font-black text-green-700">{loading ? '...' : stableBloodGroups}</p>
          <p className="mt-1 text-xs font-semibold text-green-700">Above minimum operating thresholds.</p>
        </article>
        <article className="card border-orange-100 bg-orange-50">
          <p className="text-sm font-semibold text-orange-700">Critical Groups</p>
          <p className="mt-2 text-3xl font-black text-orange-700">{loading ? '...' : criticalBloodGroups}</p>
          <p className="mt-1 text-xs font-semibold text-orange-700">Immediate intervention recommended.</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Low Stock Groups</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : lowStockGroups}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Watch and likely-shortage groups.</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Available Approved Donors</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : totalEligibleDonors}</p>
          <p className="mt-1 text-xs font-semibold text-muted">Eligible donors across current warning groups.</p>
        </article>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
        <section id="risk-alerts" className="card scroll-mt-24" tabIndex={-1}>
          <h2 className="text-lg font-bold text-primary">Inventory Risk Alerts</h2>
          {filteredRiskAlertItems.length === 0 ? (
            <p className="mt-3 rounded-2xl border border-green-100 bg-green-50 p-4 text-sm font-semibold text-green-800">
              {riskLevelFilter === 'CRITICAL'
                ? 'No blood groups are currently classified as critical.'
                : 'No current inventory alerts. Continue routine monitoring.'}
            </p>
          ) : (
            <div className="mt-3 space-y-3">
              {filteredRiskAlertItems.slice(0, 6).map((item) => {
                const detailRow = inventoryHealthRows.find((row) => row.bloodGroup === item.bloodGroup);
                return (
                <article
                  key={`alert-${item.bloodGroup}`}
                  className={`rounded-2xl border border-slate-200 p-4 transition ${highlightedBloodGroup === item.bloodGroup ? 'ring-4 ring-red-200' : ''}`}
                  data-blood-group={item.bloodGroup}
                  tabIndex={-1}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <h3 className="text-base font-black text-slate-950">
                        {formatBloodGroup(item.bloodGroup)} inventory alert
                      </h3>
                      <p className="text-sm font-semibold text-muted">
                        {item.level === 'CRITICAL' ? 'Critical operational risk' : 'Operational monitoring recommended'}
                      </p>
                    </div>
                    <span className={`rounded-full border px-3 py-1 text-xs font-black ${getWarningLevelClassName(item.level)}`}>
                      {getWarningLevelLabel(item.level)}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 rounded-2xl bg-slate-50 p-3 text-xs text-slate-700 sm:grid-cols-3">
                    <span>Current Inventory: <strong>{item.currentUnits}</strong></span>
                    <span>Usable Units: <strong>{getWarningUsableUnits(item)}</strong></span>
                    <span>Average Daily Usage: <strong>{typeof item.averageDailyUsage === 'number' ? item.averageDailyUsage.toFixed(1) : 'No recent usage'}</strong></span>
                    <span>Blood Expiring Soon: <strong>{item.expiringUnits}</strong></span>
                    <span>Emergency Demand: <strong>{item.activeDemandUnits}</strong></span>
                    <span>Appointments Scheduled: <strong>{item.scheduledDonationUnits}</strong></span>
                    <span>Incoming Donations: <strong>{item.incomingTransferUnits}</strong></span>
                    <span>Available Donors: <strong>{item.exactAvailableDonors ?? 0} exact / {item.compatibleAvailableDonors ?? item.eligibleDonorCount ?? 0} compatible</strong></span>
                    {detailRow ? <span>Risk Score: <strong>{detailRow.riskScore}/100 - {detailRow.riskLabel}</strong></span> : null}
                  </div>
                  <p className="mt-3 text-sm font-semibold text-slate-700">{item.explanation}</p>
                  <p className="mt-2 rounded-xl bg-red-50 px-3 py-2 text-sm font-black text-primary">
                    Recommended action: {item.recommendedAction ?? 'Launch donor mobilization campaign.'}
                  </p>
                  <button
                    className="mt-3 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:border-primary hover:text-primary"
                    onClick={() =>
                      setExpandedWarnings((previous) => ({
                        ...previous,
                        [item.bloodGroup]: !previous[item.bloodGroup],
                      }))
                    }
                    type="button"
                  >
                    {expandedWarnings[item.bloodGroup] ? 'Hide operational details' : 'Why am I seeing this warning?'}
                  </button>
                  {expandedWarnings[item.bloodGroup] ? (
                    <div className="mt-3 rounded-2xl border border-slate-200 bg-white p-4">
                      <h4 className="text-sm font-black uppercase tracking-wide text-primary">Operational Details</h4>
                      <div className="mt-3 grid gap-2 text-xs text-slate-700 sm:grid-cols-2">
                        <span>Current Units: <strong>{item.currentUnits}</strong></span>
                        <span>Usable Units: <strong>{getWarningUsableUnits(item)}</strong></span>
                        <span>Average Daily Usage: <strong>{typeof item.averageDailyUsage === 'number' ? item.averageDailyUsage.toFixed(1) : 'No recent usage'}</strong></span>
                        <span>Emergency Requests: <strong>{item.activeDemandUnits}</strong></span>
                        <span>Blood Expiring Soon: <strong>{item.expiringUnits}</strong></span>
                        <span>Scheduled Donations: <strong>{item.scheduledDonationUnits}</strong></span>
                        <span>Incoming Blood Transfers: <strong>{item.incomingTransferUnits}</strong></span>
                        <span>Available Approved Donors: <strong>{item.exactAvailableDonors ?? 0} exact / {item.compatibleAvailableDonors ?? item.eligibleDonorCount ?? 0} compatible</strong></span>
                        {detailRow ? <span>Risk Score: <strong>{detailRow.riskScore}/100 ({detailRow.riskLabel})</strong></span> : null}
                        {detailRow ? <span>Status: <strong>{detailRow.status}</strong></span> : null}
                      </div>
                      {detailRow ? (
                        <div className="mt-3 rounded-xl bg-red-50 p-3">
                          <p className="text-xs font-black uppercase tracking-wide text-red-700">Triggered Risk Factors</p>
                          <ul className="mt-2 space-y-1 text-xs font-semibold text-red-900">
                            {detailRow.riskFactors.map((factor) => (
                              <li key={`${item.bloodGroup}-${factor}`}>- {formatRiskReason(factor)}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="mt-3 rounded-xl bg-slate-50 p-3">
                        <p className="text-xs font-black uppercase tracking-wide text-slate-600">Rule Triggered</p>
                        <ul className="mt-2 space-y-1 text-xs font-semibold text-slate-700">
                          {getRuleTriggers(item).map((trigger) => (
                            <li key={`${item.bloodGroup}-${trigger}`}>- {trigger}</li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  ) : null}
                </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card">
          <h2 className="text-lg font-bold text-primary">Current Alert Mix</h2>
          <p className="mt-1 text-sm text-muted">Live inventory status from stock, expiry, active demand, thresholds, and donor availability.</p>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Critical', count: criticalBloodGroups, className: 'bg-red-100 text-red-800' },
              { label: 'Low Stock', count: likelyShortageGroups, className: 'bg-orange-100 text-orange-800' },
              { label: 'Monitor', count: monitorBloodGroups, className: 'bg-amber-100 text-amber-800' },
              { label: 'Healthy', count: stableBloodGroups, className: 'bg-green-100 text-green-800' },
            ].map((item) => (
              <div key={item.label} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-100 p-3">
                <p className="font-black text-slate-950">{item.label}</p>
                <span className={`rounded-full px-3 py-1 text-xs font-black ${item.className}`}>
                  {item.count} group(s)
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
      <section className="card">
        <h2 className="text-lg font-bold text-primary">Recommended Actions</h2>
        {recommendationItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No proactive donor mobilization is required right now.</p>
        ) : (
          <div className="mt-3 grid gap-3 lg:grid-cols-2">
            {recommendationItems.map((item) => (
              <article key={`recommendation-${item.bloodGroup}`} className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="font-black text-slate-950">{formatBloodGroup(item.bloodGroup)} Action Plan</h3>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black ${getWarningLevelClassName(item.level)}`}>
                    {getWarningLevelLabel(item.level)}
                  </span>
                </div>
                <p className="mt-2 text-sm font-semibold text-slate-700">
                  {item.recommendedAction ?? item.explanation}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-white"
                    onClick={() => setCompatibilitySummary(item.bloodGroup)}
                    type="button"
                  >
                    Notify Donors
                  </button>
                  <button
                    className="rounded-xl border border-primary px-3 py-2 text-xs font-black text-primary"
                    onClick={async () => {
                      try {
                        setCompatibilitySummary(item.bloodGroup);
                        const preview = await previewCompatibleDonors({
                          bloodGroup: item.bloodGroup,
                          warningLevel: item.level,
                          forecastPeriodHours: item.forecastPeriodHours ?? 48,
                          radiusKm: 25,
                        });
                        setMobilizationPreviews((prev) => ({ ...prev, [item.bloodGroup]: preview }));
                        setMobilizationMessage(`Compatible donor preview ready for ${formatBloodGroup(item.bloodGroup)}.`);
                      } catch (error: any) {
                        const apiError = error?.response?.data?.error;
                        const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
                        setMobilizationMessage(extracted ?? 'Unable to view compatible donors right now.');
                      }
                    }}
                    type="button"
                  >
                    View Compatible Donors
                  </button>
                  <Link className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" to="/hospital/inventory">
                    View Inventory
                  </Link>
                  <Link className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700" to="/hospital/active-requests">
                    View Emergency Requests
                  </Link>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section id="stock-charts" className="grid gap-4 scroll-mt-24 xl:grid-cols-2">
        <article id="early-warnings" className="card scroll-mt-24">
          <h2 className="text-lg font-bold text-primary">Current Inventory by Blood Group</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={inventoryChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bloodGroup" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="currentUnits" name="Current Units" fill="#be123c" radius={[8, 8, 0, 0]} />
                <Bar dataKey="expiringSoon" name="Expiring Soon" fill="#f59e0b" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article id="historical-trends" className="card scroll-mt-24">
          <h2 className="text-lg font-bold text-primary">Inventory Risk by Blood Group</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={riskChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bloodGroup" />
                <YAxis allowDecimals />
                <Tooltip />
                <Bar dataKey="riskScore" name="Risk Score" fill="#f97316" radius={[8, 8, 0, 0]} />
                <Bar dataKey="eligibleDonors" name="Available Donors" fill="#16a34a" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Blood Usage Trend</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={usageTrendData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickFormatter={(value) => new Date(value).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} />
                <YAxis allowDecimals={false} />
                <Tooltip labelFormatter={(value) => new Date(String(value)).toLocaleDateString()} />
                <Line type="monotone" dataKey="units" name="Units" stroke="#be123c" strokeWidth={3} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Emergency Requests vs Inventory</h2>
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={emergencyVsInventoryData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="bloodGroup" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="inventory" name="Current Inventory" fill="#2563eb" radius={[8, 8, 0, 0]} />
                <Bar dataKey="emergencyDemand" name="Emergency Demand" fill="#dc2626" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No recent activity yet. Stock warnings and donor mobilisation updates will appear here.</p>
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
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Blood Stock Early Warning</h2>
          {stockWarnings.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No early warning records yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {stockWarnings.slice(0, 6).map((item) => (
                <li
                  id={`early-warning-${item.bloodGroup}`}
                  key={`${item.hospitalId}-${item.bloodGroup}-${item.level}`}
                  className={`rounded border border-slate-200 p-3 transition ${highlightedBloodGroup === item.bloodGroup ? 'ring-4 ring-red-200' : ''}`}
                  data-blood-group={item.bloodGroup}
                  tabIndex={-1}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-bold text-slate-900">{item.bloodGroup}</p>
                    <span className={`rounded-full px-2 py-1 text-xs font-bold ${
                      item.level === 'CRITICAL'
                        ? 'bg-red-100 text-red-700'
                        : item.level === 'LIKELY_SHORTAGE'
                          ? 'bg-amber-100 text-amber-700'
                          : item.level === 'WATCH'
                            ? 'bg-yellow-100 text-yellow-700'
                            : 'bg-green-100 text-green-700'
                    }`}>
                      {item.level.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="mt-2 grid gap-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-700 sm:grid-cols-2">
                    <span>Current: <strong>{item.currentUnits}</strong></span>
                    <span>Usable: <strong>{getWarningUsableUnits(item)}</strong></span>
                    <span>Demand: <strong>{item.activeDemandUnits}</strong></span>
                    <span>Daily usage: <strong>{typeof item.averageDailyUsage === 'number' ? `${item.averageDailyUsage.toFixed(1)} units/day` : 'No recent usage'}</strong></span>
                    <span>Expiring: <strong>{item.expiringUnits}</strong></span>
                    <span>Incoming: <strong>{item.incomingTransferUnits}</strong></span>
                    <span>Appointments: <strong>{item.scheduledDonationUnits}</strong></span>
                    <span>Eligible donors: <strong>{item.exactAvailableDonors ?? 0} exact / {item.compatibleAvailableDonors ?? item.eligibleDonorCount ?? 0} compatible</strong></span>
                  </div>
                  <p className="mt-2 text-xs text-slate-500">{item.recommendedAction ?? item.explanation}</p>
                  <p className="mt-2 rounded-lg bg-white px-2 py-1 text-xs font-black text-primary">
                    Recommended action: {item.recommendedActionType ?? (item.level === 'STABLE' ? 'No Immediate Action Required' : 'Launch Proactive Donor Campaign')}
                  </p>
                  <div className="mt-2 rounded-xl bg-white p-2 text-xs text-slate-700">
                    <span className="font-black">Risk score: </span>
                    <span>{inventoryHealthRows.find((row) => row.bloodGroup === item.bloodGroup)?.riskScore ?? item.riskScore ?? 0}/100</span>
                  </div>
                  {mobilizationPreviews[item.bloodGroup] ? (
                    <div className="mt-2 rounded-xl border border-blue-100 bg-blue-50 p-2 text-xs text-blue-800">
                      <p className="font-black">Campaign preview</p>
                      <p>{mobilizationPreviews[item.bloodGroup].previewNote}</p>
                      <p className="mt-1">
                        Radius: {mobilizationPreviews[item.bloodGroup].radiusKm}km - Outreach window: {mobilizationPreviews[item.bloodGroup].forecastPeriodHours}h
                      </p>
                    </div>
                  ) : null}
                  {item.level !== 'STABLE' ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      <Link
                        aria-label={`Preview compatible donors for ${formatBloodGroup(item.bloodGroup)} early warning`}
                        className="rounded-xl border border-primary px-3 py-2 text-xs font-bold text-primary transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"
                        to={buildEarlyWarningDonorSearchPath(item.bloodGroup)}
                      >
                        Preview Donors
                      </Link>
                      <button
                        aria-label={`Launch donor mobilization campaign for ${formatBloodGroup(item.bloodGroup)} early warning`}
                        className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-white transition hover:bg-red-700 focus:outline-none focus:ring-4 focus:ring-red-100"
                        disabled={warningCampaignSending}
                        onClick={() => openWarningCampaign(item)}
                        type="button"
                      >
                        Launch Campaign
                      </button>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="card">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-bold text-primary">Mobilization Campaign Outcomes</h2>
            {campaigns.length ? (
              <button
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700"
                onClick={() => {
                  const rows = [
                    ['Campaign', 'Blood Group', 'Donors Notified', 'Interested', 'Appointments', 'Donations', 'Response Rate', 'Donation Success Rate'],
                    ...campaigns.map((campaign) => [
                      campaign.campaignName,
                      campaign.bloodGroup,
                      String(campaign.donorsNotified),
                      String(campaign.interestedDonors),
                      String(campaign.appointmentRequests),
                      String(campaign.completedDonations),
                      `${campaign.responseRate}%`,
                      `${campaign.donationSuccessRate}%`,
                    ]),
                  ];
                  const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n');
                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement('a');
                  link.href = url;
                  link.download = `mobilization-campaign-report-${new Date().toISOString().slice(0, 10)}.csv`;
                  link.click();
                  URL.revokeObjectURL(url);
                }}
                type="button"
              >
                Export Campaign Report
              </button>
            ) : null}
          </div>
          {campaigns.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No proactive donor campaigns have been launched yet.</p>
          ) : (
            <ul className="mt-3 space-y-3 text-sm">
              {campaigns.slice(0, 4).map((campaign) => (
                <li key={campaign.id} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-black text-slate-900">{campaign.campaignName}</p>
                      <p className="text-xs text-slate-500">
                        {campaign.forecastPeriodHours}h outreach window - {campaign.radiusKm}km radius - {formatDateTime(campaign.sentAt ?? campaign.createdAt)}
                      </p>
                    </div>
                    <span className="rounded-full bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">
                      {campaign.responseRate}% response
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2 rounded-xl bg-slate-50 p-2 text-xs text-slate-700 sm:grid-cols-3">
                    <span>Notified: <strong>{campaign.donorsNotified}</strong></span>
                    <span>Interested: <strong>{campaign.interestedDonors}</strong></span>
                    <span>Declined: <strong>{campaign.declinedResponses}</strong></span>
                    <span>Appointments: <strong>{campaign.appointmentRequests}</strong></span>
                    <span>Confirmed: <strong>{campaign.confirmedAppointments}</strong></span>
                    <span>Donations: <strong>{campaign.completedDonations}</strong></span>
                    <span>Units gained: <strong>{campaign.donatedUnits}</strong></span>
                    <span>Appt conversion: <strong>{campaign.appointmentConversionRate}%</strong></span>
                    <span>Donation success: <strong>{campaign.donationSuccessRate}%</strong></span>
                  </div>
                  {campaign.responses.some((response) => response.responseStatus !== 'NOT_AVAILABLE') ? (
                    <div className="mt-3 space-y-2">
                      {campaign.responses
                        .filter((response) => response.responseStatus !== 'NOT_AVAILABLE')
                        .slice(0, 4)
                        .map((response) => (
                          <div key={response.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-green-100 bg-green-50 px-3 py-2">
                            <div>
                              <p className="font-bold text-slate-900">{response.donor.fullName}</p>
                              <p className="text-xs text-slate-600">
                                {response.donor.donorNumber ?? 'No donor ref'} - {response.donor.bloodGroup} - {response.responseStatus.replace('_', ' ')}
                              </p>
                            </div>
                            <Link
                              className="rounded-xl bg-primary px-3 py-2 text-xs font-black text-white"
                              to={`/hospital/appointments?donorId=${response.donor.id}`}
                            >
                              Schedule Appointment
                            </Link>
                          </div>
                        ))}
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Historical Blood Stock Trends</h2>
          {!stockTrends || stockTrends.trends.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No inventory trend history is available yet.</p>
          ) : (
            <div className="mt-3 space-y-3">
              {stockTrends.trends.slice(0, 8).map((trend) => {
                const latest = trend.points[trend.points.length - 1];
                const maxUnits = Math.max(...trend.points.map((point) => point.units), 1);
                return (
                  <div key={trend.bloodGroup} className="rounded-2xl border border-slate-100 p-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="font-black text-slate-900">{trend.bloodGroup}</p>
                      <p className="text-xs font-bold text-slate-500">{latest?.units ?? 0} latest units</p>
                    </div>
                    <div className="mt-2 flex h-12 items-end gap-1">
                      {trend.points.slice(-14).map((point) => (
                        <span
                          key={`${trend.bloodGroup}-${point.date}`}
                          className="flex-1 rounded-t bg-primary/70"
                          style={{ height: `${Math.max(8, (point.units / maxUnits) * 48)}px` }}
                          title={`${new Date(point.date).toLocaleDateString()}: ${point.units} units`}
                        />
                      ))}
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      {trend.criticalEvents} critical event(s), {trend.lowEvents} low-stock event(s) in {stockTrends.windowDays} days.
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Alerts</h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No alerts right now. New stock warnings and mobilisation updates will appear here.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {alerts.map((item) => (
                <li key={item} className="rounded border border-red-200 bg-red-50 p-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}


