import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { bloodGroups } from '../constants/blood-groups';
import {
  DashboardOverview,
  getAdminActivityFeed,
  getAdminAuditLogs,
  getAdminDashboardOverview,
  getAdminDonorReviews,
  getAdminEmergencyRequests,
  getAdminInventoryMonitoring,
  getAdminNotifications,
  getAdminReports,
  getAdminSecurityMonitoring,
  searchAdminDashboard,
  updateAdminDonorReview,
  type ActivityFeedItem,
  type ActiveSessionItem,
  type AdminDashboardSearchResults,
  type AuditLogItem,
  type DashboardNotification,
  type DonorReviewItem,
  type DonorReviewStatus,
  type EmergencyRequestMonitorItem,
  type HospitalPerformancePoint,
  type InboxNotification,
  type InventoryMonitorItem,
  type PriorityLevel,
  type ReportPoint,
  type SecurityEventItem,
  type ValuePoint,
} from '../services/admin-dashboard';

type Toast = { id: number; type: 'success' | 'error'; message: string };

const bloodGroupLabel = Object.fromEntries(bloodGroups.map((item) => [item.value, item.label])) as Record<string, string>;
const statusToneMap: Record<string, string> = {
  stable: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  low: 'bg-amber-50 text-amber-700 border-amber-100',
  critical: 'bg-red-50 text-red-700 border-red-100',
  pending: 'bg-slate-100 text-slate-700 border-slate-200',
  matching: 'bg-sky-50 text-sky-700 border-sky-100',
  donor_responded: 'bg-blue-50 text-blue-700 border-blue-100',
  fulfilled: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  escalated: 'bg-red-50 text-red-700 border-red-100',
  cancelled: 'bg-slate-200 text-slate-700 border-slate-200',
  SUBMITTED: 'bg-slate-100 text-slate-700 border-slate-200',
  HOSPITAL_REVIEW: 'bg-sky-50 text-sky-700 border-sky-100',
  OFFICE_USE_COMPLETED: 'bg-violet-50 text-violet-700 border-violet-100',
  APPROVED: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  REJECTED: 'bg-red-50 text-red-700 border-red-100',
  CRITICAL: 'bg-red-50 text-red-700 border-red-100',
  WARNING: 'bg-amber-50 text-amber-700 border-amber-100',
  INFO: 'bg-slate-100 text-slate-700 border-slate-200',
};

const trendColors = ['#d31235', '#1f3b63', '#f59e0b', '#0f766e', '#7c3aed'];

const dashboardAnchors = [
  { label: 'Overview', href: '#overview' },
  { label: 'Inventory', href: '#inventory' },
  { label: 'Requests', href: '#requests' },
  { label: 'Activity', href: '#activity' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Reports', href: '#reports' },
  { label: 'Security', href: '#security' },
];

const emptyOverview: DashboardOverview = {
  summaryCards: [
    { key: 'total-donors', label: 'Total registered donors', value: 0, tone: 'primary' },
    { key: 'active-emergencies', label: 'Active emergency requests', value: 0, tone: 'danger' },
    { key: 'partner-hospitals', label: 'Partner hospitals', value: 0, tone: 'neutral' },
    { key: 'blood-units-available', label: 'Blood units available', value: 0, tone: 'success' },
  ],
  quickActions: [
    { label: 'Create Emergency Request', href: '/admin/management?section=request-tracking', color: 'primary' },
    { label: 'Add Blood Inventory', href: '/admin/management?section=inventory-tracking', color: 'navy' },
    { label: 'Broadcast Alert', href: '/admin/website-management', color: 'amber' },
  ],
};

const emptyReports: Awaited<ReturnType<typeof getAdminReports>> = {
  donationsByMonth: [],
  requestTrends: [],
  mostRequestedBloodTypes: [],
  donorResponseRates: [],
  hospitalPerformance: [],
  shortageTrends: [],
};

const emptySecurity: Awaited<ReturnType<typeof getAdminSecurityMonitoring>> = {
  recentAdminLogins: [],
  failedLoginAttempts: [],
  suspiciousAccessAttempts: [],
  activeSessions: [],
};

async function settle<T>(request: Promise<T>, fallback: T, label: string, onError: (message: string) => void) {
  const result = await Promise.allSettled([request]);
  const settled = result[0];
  if (settled.status === 'fulfilled') {
    return settled.value;
  }

  console.error(`${label} failed`, settled.reason);
  onError(`${label} could not load. Showing safe fallback data.`);
  return fallback;
}

function humanizeToken(value: string) {
  return value.replace(/_/g, ' ');
}

function formatDateTime(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function relativeTime(value?: string | null) {
  if (!value) return 'just now';
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

function toneClasses(tone: string) {
  switch (tone) {
    case 'primary':
      return 'border-red-100 bg-red-50 text-primary';
    case 'warning':
      return 'border-amber-100 bg-amber-50 text-amber-700';
    case 'success':
      return 'border-emerald-100 bg-emerald-50 text-emerald-700';
    case 'danger':
      return 'border-red-100 bg-red-50 text-red-700';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700';
  }
}

function SectionShell({
  id,
  title,
  description,
  action,
  children,
}: {
  id: string;
  title: string;
  description: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="card scroll-mt-28 border border-slate-100 shadow-[0_20px_60px_-36px_rgba(15,23,42,0.45)]">
      <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h2 className="text-xl font-bold text-slate-900">{title}</h2>
          <p className="mt-1 text-sm text-slate-500">{description}</p>
        </div>
        {action}
      </div>
      <div className="pt-5">{children}</div>
    </section>
  );
}

function StatusBadge({ label, toneKey }: { label: string; toneKey: string }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statusToneMap[toneKey] ?? statusToneMap.INFO}`}>
      {label}
    </span>
  );
}

function LoadingGrid() {
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 8 }).map((_, index) => (
        <div key={index} className="h-32 animate-pulse rounded-3xl border border-slate-100 bg-slate-50" />
      ))}
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-3xl border border-dashed border-slate-200 bg-slate-50 px-6 py-10 text-center">
      <p className="text-base font-semibold text-slate-700">{title}</p>
      <p className="mt-2 text-sm text-slate-500">{body}</p>
    </div>
  );
}

function MiniBarChart({
  data,
  valueKey = 'value',
  labelKey = 'month',
  height = 220,
}: {
  data: Array<Record<string, string | number>>;
  valueKey?: string;
  labelKey?: string;
  height?: number;
}) {
  const max = Math.max(...data.map((item) => Number(item[valueKey] ?? 0)), 1);

  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4">
      <div className="flex h-44 items-end gap-3">
        {data.map((item, index) => {
          const value = Number(item[valueKey] ?? 0);
          const label = String(item[labelKey] ?? '');
          return (
            <div key={`${label}-${index}`} className="flex flex-1 flex-col items-center gap-2">
              <div className="text-xs font-semibold text-slate-400">{value}</div>
              <div
                className="w-full rounded-t-2xl transition-all duration-500"
                style={{
                  height: `${Math.max((value / max) * height * 0.6, 8)}px`,
                  background: trendColors[index % trendColors.length],
                }}
              />
              <div className="text-center text-[11px] font-medium text-slate-500">{label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonutChart({ data }: { data: ValuePoint[] }) {
  const total = Math.max(
    data.reduce((sum, item) => sum + item.value, 0),
    1,
  );
  let current = 0;

  const segments = data.map((item, index) => {
    const start = (current / total) * 360;
    current += item.value;
    const end = (current / total) * 360;
    return `${trendColors[index % trendColors.length]} ${start}deg ${end}deg`;
  });

  return (
    <div className="flex flex-col items-center gap-4 rounded-3xl border border-slate-100 bg-white p-4 md:flex-row">
      <div
        className="relative h-40 w-40 rounded-full"
        style={{ background: `conic-gradient(${segments.join(', ')})` }}
      >
        <div className="absolute inset-5 rounded-full bg-white" />
        <div className="absolute inset-0 flex items-center justify-center text-center">
          <div>
            <p className="text-2xl font-bold text-slate-900">{total}</p>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Responses</p>
          </div>
        </div>
      </div>
      <div className="grid flex-1 gap-3">
        {data.map((item, index) => (
          <div key={item.label} className="flex items-center justify-between rounded-2xl border border-slate-100 px-4 py-3">
            <div className="flex items-center gap-3">
              <span
                className="h-3 w-3 rounded-full"
                style={{ backgroundColor: trendColors[index % trendColors.length] }}
                aria-hidden="true"
              />
              <span className="text-sm font-semibold text-slate-700">{item.label}</span>
            </div>
            <span className="text-sm font-bold text-slate-900">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminDashboardPage() {
  const navigate = useNavigate();
  const [initialLoading, setInitialLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<AdminDashboardSearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const [overview, setOverview] = useState<DashboardOverview | null>(null);
  const [inventory, setInventory] = useState<InventoryMonitorItem[]>([]);
  const [emergencyRequestData, setEmergencyRequestData] = useState<{
    total: number;
    items: EmergencyRequestMonitorItem[];
    hospitals: { id: string; hospitalName: string }[];
  }>({ total: 0, items: [], hospitals: [] });
  const [activityData, setActivityData] = useState<{ total: number; items: ActivityFeedItem[] }>({ total: 0, items: [] });
  const [notificationData, setNotificationData] = useState<{ systemNotifications: DashboardNotification[]; inbox: InboxNotification[] }>({
    systemNotifications: [],
    inbox: [],
  });
  const [reviewData, setReviewData] = useState<{
    total: number;
    items: DonorReviewItem[];
    hospitals: { id: string; hospitalName: string }[];
  }>({ total: 0, items: [], hospitals: [] });
  const [auditData, setAuditData] = useState<{ total: number; items: AuditLogItem[]; users: { id: string; email: string }[] }>({
    total: 0,
    items: [],
    users: [],
  });
  const [reports, setReports] = useState<{
    donationsByMonth: ReportPoint[];
    requestTrends: ReportPoint[];
    mostRequestedBloodTypes: Array<{ bloodType: string; value: number }>;
    donorResponseRates: ValuePoint[];
    hospitalPerformance: HospitalPerformancePoint[];
    shortageTrends: InventoryMonitorItem[];
  } | null>(null);
  const [security, setSecurity] = useState<{
    recentAdminLogins: SecurityEventItem[];
    failedLoginAttempts: SecurityEventItem[];
    suspiciousAccessAttempts: SecurityEventItem[];
    activeSessions: ActiveSessionItem[];
  } | null>(null);

  const [emergencyFilters, setEmergencyFilters] = useState({
    bloodType: '',
    urgency: '',
    hospitalId: '',
    status: '',
    search: '',
    skip: 0,
    take: 8,
  });
  const [reviewFilters, setReviewFilters] = useState({
    status: '',
    hospitalId: '',
    search: '',
    skip: 0,
    take: 6,
  });
  const [auditFilters, setAuditFilters] = useState({
    action: '',
    userId: '',
    module: '',
    from: '',
    to: '',
    skip: 0,
    take: 6,
  });
  const [reviewModal, setReviewModal] = useState<null | {
    review: DonorReviewItem;
    status: DonorReviewStatus;
  }>(null);
  const [reviewForm, setReviewForm] = useState({ reviewNotes: '', officeUseNotes: '' });

  const pushToast = (type: Toast['type'], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setToasts((current) => [...current, { id, type, message }]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== id));
    }, 4000);
  };

  const loadCoreDashboard = async () => {
    const onError = (message: string) => pushToast('error', message);

    const [overviewData, inventoryData, requestsData, activityFeedData, notificationsData, reviewsData, auditLogsData, reportsData, securityData] =
      await Promise.all([
        settle(getAdminDashboardOverview(), emptyOverview, 'Dashboard overview', onError),
        settle(getAdminInventoryMonitoring(), [] as InventoryMonitorItem[], 'Inventory monitoring', onError),
        settle(getAdminEmergencyRequests(emergencyFilters), { total: 0, items: [], hospitals: [] }, 'Emergency request queue', onError),
        settle(getAdminActivityFeed({ take: 12 }), { total: 0, items: [] }, 'Activity feed', onError),
        settle(getAdminNotifications(), { systemNotifications: [], inbox: [] }, 'Notifications', onError),
        settle(getAdminDonorReviews(reviewFilters), { total: 0, items: [], hospitals: [] }, 'Donor review queue', onError),
        settle(getAdminAuditLogs(auditFilters), { total: 0, items: [], users: [] }, 'Audit logs', onError),
        settle(getAdminReports(), emptyReports, 'Reports', onError),
        settle(getAdminSecurityMonitoring(), emptySecurity, 'Security monitoring', onError),
      ]);

    setOverview(overviewData);
    setInventory(inventoryData);
    setEmergencyRequestData(requestsData);
    setActivityData(activityFeedData);
    setNotificationData(notificationsData);
    setReviewData(reviewsData);
    setAuditData(auditLogsData);
    setReports(reportsData);
    setSecurity(securityData);
  };

  useEffect(() => {
    const boot = async () => {
      setInitialLoading(true);
      try {
        await loadCoreDashboard();
      } catch (error: any) {
        pushToast('error', error?.response?.data?.error?.message ?? 'Could not load the command center.');
      } finally {
        setInitialLoading(false);
      }
    };
    boot();
  }, []);

  useEffect(() => {
    if (initialLoading) return;
    const interval = window.setInterval(async () => {
      try {
        setRefreshing(true);
        await loadCoreDashboard();
      } catch {
        // Keep the experience calm; we already show the last good data.
      } finally {
        setRefreshing(false);
      }
    }, 30000);
    return () => window.clearInterval(interval);
  }, [initialLoading, emergencyFilters, reviewFilters, auditFilters]);

  useEffect(() => {
    if (initialLoading) return;
    getAdminEmergencyRequests(emergencyFilters)
      .then(setEmergencyRequestData)
      .catch((error: any) => pushToast('error', error?.response?.data?.error?.message ?? 'Could not refresh emergency requests.'));
  }, [emergencyFilters]);

  useEffect(() => {
    if (initialLoading) return;
    getAdminDonorReviews(reviewFilters)
      .then(setReviewData)
      .catch((error: any) => pushToast('error', error?.response?.data?.error?.message ?? 'Could not refresh donor reviews.'));
  }, [reviewFilters]);

  useEffect(() => {
    if (initialLoading) return;
    getAdminAuditLogs(auditFilters)
      .then(setAuditData)
      .catch((error: any) => pushToast('error', error?.response?.data?.error?.message ?? 'Could not refresh audit logs.'));
  }, [auditFilters]);

  const lowStockSummary = useMemo(
    () => inventory.filter((item) => item.status !== 'stable').sort((a, b) => a.availableUnits - b.availableUnits),
    [inventory],
  );

  const quickActionHref = (label: string, href: string) => {
    const map: Record<string, string> = {
      'Create Emergency Request': '/admin/management?section=request-tracking',
      'Add Blood Inventory': '/admin/management?section=inventory-tracking',
      'Approve Pending Donors': '#reviews',
      'Broadcast Alert': '/admin/website-management',
      'Add Partner Hospital': '/admin/website-management',
    };
    return map[label] ?? href;
  };

  const handleSearch = async (event: FormEvent) => {
    event.preventDefault();
    if (searchTerm.trim().length < 2) {
      pushToast('error', 'Enter at least two characters to search across operations data.');
      return;
    }
    try {
      setSearchLoading(true);
      setSearchResults(await searchAdminDashboard(searchTerm.trim()));
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Global search could not be completed.');
    } finally {
      setSearchLoading(false);
    }
  };

  const openReviewModal = (review: DonorReviewItem, status: DonorReviewStatus) => {
    setReviewModal({ review, status });
    setReviewForm({
      reviewNotes: review.reviewNotes ?? '',
      officeUseNotes: review.officeUseNotes ?? '',
    });
  };

  const handleReviewUpdate = async () => {
    if (!reviewModal) return;
    try {
      setBusy(true);
      await updateAdminDonorReview(reviewModal.review.id, {
        status: reviewModal.status,
        reviewNotes: reviewForm.reviewNotes,
        officeUseNotes: reviewForm.officeUseNotes,
      });
      pushToast('success', `Review moved to ${humanizeToken(reviewModal.status)}.`);
      setReviewModal(null);
      setReviewData(await getAdminDonorReviews(reviewFilters));
      setActivityData(await getAdminActivityFeed({ take: 12 }));
      setAuditData(await getAdminAuditLogs(auditFilters));
      setOverview(await getAdminDashboardOverview());
    } catch (error: any) {
      pushToast('error', error?.response?.data?.error?.message ?? 'Could not update donor review.');
    } finally {
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!reports) return;
    const lines = [
      ['Section', 'Label', 'Value'],
      ...reports.donationsByMonth.map((item) => ['Donations by month', item.month, String(item.value)]),
      ...reports.requestTrends.map((item) => ['Blood request trends', item.month, String(item.value)]),
      ...reports.mostRequestedBloodTypes.map((item) => [
        'Most requested blood types',
        bloodGroupLabel[item.bloodType] ?? item.bloodType,
        String(item.value),
      ]),
      ...reports.donorResponseRates.map((item) => ['Donor response rates', item.label, String(item.value)]),
      ...reports.hospitalPerformance.map((item) => [
        'Hospital performance',
        item.hospitalName,
        `${item.completedRequests}/${item.totalRequests} (${item.completionRate}%)`,
      ]),
    ];

    const csv = lines.map((line) => line.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `admin-command-center-report-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const exportPdf = () => {
    if (!reports || !overview) return;
    const printWindow = window.open('', '_blank', 'width=1200,height=900');
    if (!printWindow) {
      pushToast('error', 'Pop-up was blocked. Please allow pop-ups to export the PDF view.');
      return;
    }

    const content = `
      <html>
        <head>
          <title>Admin Command Center Report</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 32px; color: #172033; }
            h1, h2 { color: #c8102e; }
            table { width: 100%; border-collapse: collapse; margin-top: 16px; }
            th, td { border: 1px solid #e5e7eb; padding: 10px; text-align: left; }
            th { background: #f8fafc; }
            .grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; margin-top: 16px; }
            .card { border: 1px solid #e5e7eb; border-radius: 16px; padding: 16px; }
          </style>
        </head>
        <body>
          <h1>Hospital Command Center Report</h1>
          <p>Generated ${new Date().toLocaleString()}</p>
          <div class="grid">
            ${overview.summaryCards
              .map(
                (card) => `
                  <div class="card">
                    <h2>${card.label}</h2>
                    <p style="font-size: 28px; font-weight: bold;">${card.value}${card.suffix ?? ''}</p>
                  </div>
                `,
              )
              .join('')}
          </div>
          <h2>Monthly Donations</h2>
          <table>
            <thead><tr><th>Month</th><th>Units</th></tr></thead>
            <tbody>${reports.donationsByMonth.map((item) => `<tr><td>${item.month}</td><td>${item.value}</td></tr>`).join('')}</tbody>
          </table>
          <h2>Hospital Request Performance</h2>
          <table>
            <thead><tr><th>Hospital</th><th>Total Requests</th><th>Completed</th><th>Completion Rate</th></tr></thead>
            <tbody>${reports.hospitalPerformance
              .map(
                (item) =>
                  `<tr><td>${item.hospitalName}</td><td>${item.totalRequests}</td><td>${item.completedRequests}</td><td>${item.completionRate}%</td></tr>`,
              )
              .join('')}</tbody>
          </table>
        </body>
      </html>
    `;
    printWindow.document.write(content);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  return (
    <section className="space-y-6">
      <div className="card border border-slate-100 bg-[radial-gradient(circle_at_top_left,_rgba(200,16,46,0.1),_transparent_35%),linear-gradient(135deg,#ffffff,_#f8fafc)] shadow-[0_24px_70px_-42px_rgba(15,23,42,0.35)]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="inline-flex rounded-full border border-red-100 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.28em] text-primary">
              Hospital command center
            </div>
            <h1 className="mt-4 text-3xl font-black text-slate-950 md:text-4xl">Admin operations dashboard</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              A real-time operational view of donor readiness, emergency fulfillment, blood stock, website signals, and security health—designed to help us run the platform like a real hospital response center.
            </p>
          </div>
          <div className="grid gap-3 rounded-3xl border border-slate-100 bg-white/90 p-4 shadow-sm sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Refresh mode</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">{refreshing ? 'Syncing live operations…' : 'Auto-refresh every 30 seconds'}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Action lane</p>
              <p className="mt-2 text-sm font-semibold text-slate-800">Escalations, reviews, shortages, analytics</p>
            </div>
          </div>
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          {dashboardAnchors.map((anchor) => (
            <a
              key={anchor.href}
              href={anchor.href}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:bg-red-50 hover:text-primary"
            >
              {anchor.label}
            </a>
          ))}
          <Link
            to="/admin/website-management"
            className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
          >
            Open Website Management
          </Link>
        </div>
      </div>

      <SectionShell
        id="overview"
        title="Dashboard analytics overview"
        description="Professional summary cards powered by live database metrics and ready for board-level reporting."
      >
        {initialLoading || !overview ? (
          <LoadingGrid />
        ) : (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {overview.summaryCards.map((card) => (
                <article key={card.key} className={`rounded-3xl border p-5 shadow-sm ${toneClasses(card.tone)}`}>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em]">{card.label}</p>
                  <div className="mt-4 flex items-end gap-2">
                    <span className="text-4xl font-black">{card.value.toLocaleString()}</span>
                    {card.suffix ? <span className="pb-2 text-sm font-semibold">{card.suffix}</span> : null}
                  </div>
                </article>
              ))}
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {overview.quickActions.map((action) => (
                <button
                  key={action.label}
                  type="button"
                  onClick={() => navigate(quickActionHref(action.label, action.href))}
                  className={`rounded-2xl px-4 py-4 text-left text-sm font-semibold shadow-sm transition ${
                    action.color === 'navy'
                      ? 'bg-slate-900 text-white hover:bg-slate-800'
                      : action.color === 'amber'
                        ? 'bg-amber-500 text-white hover:bg-amber-600'
                        : 'bg-primary text-white hover:bg-red-700'
                  }`}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </>
        )}
      </SectionShell>

      <SectionShell
        id="inventory"
        title="Blood inventory monitoring"
        description="Track every blood group with availability, low/critical thresholds, expiry risk, and freshness signals."
        action={lowStockSummary.length ? <StatusBadge label={`${lowStockSummary.length} low stock groups`} toneKey="critical" /> : undefined}
      >
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {inventory.map((item) => (
            <article key={item.bloodGroup} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">Blood group</p>
                  <h3 className="mt-2 text-3xl font-black text-slate-950">{bloodGroupLabel[item.bloodGroup] ?? item.bloodGroup}</h3>
                </div>
                <StatusBadge label={item.status} toneKey={item.status} />
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Available units</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{item.availableUnits}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">Expiry warning</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">{item.expiringUnits}</p>
                </div>
              </div>

              <div className="mt-4 space-y-2 text-sm text-slate-600">
                <p>Critical threshold: <span className="font-semibold text-slate-900">{item.criticalThreshold}</span></p>
                <p>Low threshold: <span className="font-semibold text-slate-900">{item.lowThreshold}</span></p>
                <p>Last updated: <span className="font-semibold text-slate-900">{formatDateTime(item.lastUpdated)}</span></p>
              </div>
            </article>
          ))}
        </div>
      </SectionShell>

      <SectionShell
        id="requests"
        title="Emergency request monitoring console"
        description="Review the live request queue, filter by urgency or hospital, and quickly identify escalations and donor response gaps."
      >
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <select
            value={emergencyFilters.bloodType}
            onChange={(event) => setEmergencyFilters((current) => ({ ...current, bloodType: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            <option value="">All blood types</option>
            {bloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
          <select
            value={emergencyFilters.urgency}
            onChange={(event) => setEmergencyFilters((current) => ({ ...current, urgency: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            <option value="">All urgency levels</option>
            {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as PriorityLevel[]).map((level) => (
              <option key={level} value={level}>
                {level}
              </option>
            ))}
          </select>
          <select
            value={emergencyFilters.hospitalId}
            onChange={(event) => setEmergencyFilters((current) => ({ ...current, hospitalId: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            <option value="">All hospitals</option>
            {emergencyRequestData.hospitals.map((hospital) => (
              <option key={hospital.id} value={hospital.id}>
                {hospital.hospitalName}
              </option>
            ))}
          </select>
          <select
            value={emergencyFilters.status}
            onChange={(event) => setEmergencyFilters((current) => ({ ...current, status: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            <option value="">All statuses</option>
            {['pending', 'matching', 'donor_responded', 'fulfilled', 'escalated', 'cancelled'].map((status) => (
              <option key={status} value={status}>
                {humanizeToken(status)}
              </option>
            ))}
          </select>
          <input
            value={emergencyFilters.search}
            onChange={(event) => setEmergencyFilters((current) => ({ ...current, search: event.target.value, skip: 0 }))}
            placeholder="Search patient code, location, hospital"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-400"
          />
        </div>

        <div className="mt-5 overflow-hidden rounded-3xl border border-slate-100">
          <div className="overflow-x-auto">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.25em] text-slate-400">
                <tr>
                  <th className="px-4 py-4">Blood Type</th>
                  <th className="px-4 py-4">Hospital</th>
                  <th className="px-4 py-4">Urgency</th>
                  <th className="px-4 py-4">Status</th>
                  <th className="px-4 py-4">Matched</th>
                  <th className="px-4 py-4">Responses</th>
                  <th className="px-4 py-4">Created</th>
                </tr>
              </thead>
              <tbody>
                {emergencyRequestData.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-4 font-semibold text-slate-900">{bloodGroupLabel[item.bloodType] ?? item.bloodType}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{item.hospitalName}</p>
                      <p className="text-xs text-slate-500">{item.location}</p>
                    </td>
                    <td className="px-4 py-4"><StatusBadge label={item.urgencyLevel} toneKey={item.urgencyLevel} /></td>
                    <td className="px-4 py-4"><StatusBadge label={humanizeToken(item.requestStatus)} toneKey={item.requestStatus} /></td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{item.matchedDonorsCount}</td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{item.donorResponseCount}</td>
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{relativeTime(item.timeCreated)}</p>
                      <p className="text-xs text-slate-500">{formatDateTime(item.timeCreated)}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {emergencyRequestData.items.length === 0 ? (
            <div className="border-t border-slate-100 p-6">
              <EmptyState title="No emergency requests match these filters" body="Try clearing one or more filters to widen the live queue." />
            </div>
          ) : null}
        </div>

        <Pagination
          total={emergencyRequestData.total}
          skip={emergencyFilters.skip}
          take={emergencyFilters.take}
          onPrevious={() => setEmergencyFilters((current) => ({ ...current, skip: Math.max(current.skip - current.take, 0) }))}
          onNext={() =>
            setEmergencyFilters((current) => ({
              ...current,
              skip: current.skip + current.take,
            }))
          }
        />
      </SectionShell>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <SectionShell
          id="activity"
          title="Real-time activity feed"
          description="Recent operational movement across donor onboarding, emergency response, approvals, and inventory."
        >
          <div className="space-y-4">
            {activityData.items.length ? (
              activityData.items.map((item) => (
                <article key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <p className="mt-1 text-sm text-slate-600">{item.description}</p>
                    </div>
                    <StatusBadge label={humanizeToken(item.module)} toneKey="INFO" />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs font-medium text-slate-500">
                    <span>{item.actorName ?? 'System'}</span>
                    <span>{relativeTime(item.createdAt)}</span>
                    <span>{formatDateTime(item.createdAt)}</span>
                  </div>
                </article>
              ))
            ) : (
              <EmptyState title="No activity has been captured yet" body="As donor registration, requests, and reviews happen, the feed will populate automatically." />
            )}
          </div>
        </SectionShell>

        <SectionShell
          id="notifications"
          title="Notification center"
          description="Low stock, expiry warnings, unmatched critical requests, and inbound in-app messages."
        >
          <div className="space-y-4">
            {notificationData.systemNotifications.slice(0, 4).map((item) => (
              <article key={item.id} className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">{item.title}</p>
                  <StatusBadge label={item.severity} toneKey={item.severity} />
                </div>
                <p className="mt-2 text-sm text-slate-600">{item.body}</p>
                <p className="mt-3 text-xs font-medium text-slate-500">{formatDateTime(item.createdAt)}</p>
              </article>
            ))}

            <div className="rounded-3xl border border-slate-100 bg-slate-50 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-slate-400">Latest inbox notifications</p>
              <div className="mt-3 space-y-3">
                {notificationData.inbox.slice(0, 4).map((item) => (
                  <div key={item.id} className="rounded-2xl bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-slate-900">{item.title}</p>
                      <span className={`h-2.5 w-2.5 rounded-full ${item.isRead ? 'bg-slate-300' : 'bg-primary'}`} aria-hidden="true" />
                    </div>
                    <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                    <p className="mt-2 text-xs text-slate-500">{item.userEmail}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </SectionShell>
      </div>

      <SectionShell
        id="reviews"
        title="Donor eligibility review queue"
        description="Clinical review workflow for submitted donor forms with clear decision support, timestamps, and reviewer visibility."
      >
        <div className="grid gap-3 md:grid-cols-4">
          <select
            value={reviewFilters.status}
            onChange={(event) => setReviewFilters((current) => ({ ...current, status: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            <option value="">All statuses</option>
            {(['SUBMITTED', 'HOSPITAL_REVIEW', 'OFFICE_USE_COMPLETED', 'APPROVED', 'REJECTED'] as DonorReviewStatus[]).map((status) => (
              <option key={status} value={status}>
                {humanizeToken(status)}
              </option>
            ))}
          </select>
          <select
            value={reviewFilters.hospitalId}
            onChange={(event) => setReviewFilters((current) => ({ ...current, hospitalId: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            <option value="">All hospitals</option>
            {reviewData.hospitals.map((hospital) => (
              <option key={hospital.id} value={hospital.id}>
                {hospital.hospitalName}
              </option>
            ))}
          </select>
          <input
            value={reviewFilters.search}
            onChange={(event) => setReviewFilters((current) => ({ ...current, search: event.target.value, skip: 0 }))}
            placeholder="Search donor name or location"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-400"
          />
          <Link
            to="/admin/management?section=donors"
            className="flex items-center justify-center rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white"
          >
            Open donor manager
          </Link>
        </div>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {reviewData.items.length ? (
            reviewData.items.map((review) => (
              <article key={review.id} className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">{review.donor.fullName}</h3>
                    <p className="mt-1 text-sm text-slate-500">{review.donor.user.email} • {bloodGroupLabel[review.donor.bloodGroup] ?? review.donor.bloodGroup}</p>
                  </div>
                  <StatusBadge label={humanizeToken(review.status)} toneKey={review.status} />
                </div>

                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  <InfoPair label="Location" value={review.donor.location} />
                  <InfoPair label="Phone" value={review.donor.phone ?? 'No phone on file'} />
                  <InfoPair label="Hospital" value={review.selectedHospital?.hospitalName ?? 'Not selected yet'} />
                  <InfoPair label="Reviewer" value={review.reviewer?.email ?? 'Pending assignment'} />
                </div>

                <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
                  <p><span className="font-semibold text-slate-800">Review notes:</span> {review.reviewNotes ?? 'No clinical notes yet.'}</p>
                  <p className="mt-2"><span className="font-semibold text-slate-800">Office use:</span> {review.officeUseNotes ?? 'Office use section not completed yet.'}</p>
                </div>

                <div className="mt-4 grid gap-2 text-xs font-medium text-slate-500 sm:grid-cols-2">
                  <span>Submitted: {formatDateTime(review.submittedAt)}</span>
                  <span>Hospital review: {formatDateTime(review.hospitalReviewedAt)}</span>
                  <span>Office complete: {formatDateTime(review.officeCompletedAt)}</span>
                  <span>Decision: {formatDateTime(review.approvedAt ?? review.rejectedAt)}</span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {(['HOSPITAL_REVIEW', 'OFFICE_USE_COMPLETED', 'APPROVED', 'REJECTED'] as DonorReviewStatus[]).map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => openReviewModal(review, status)}
                      className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
                        status === 'APPROVED'
                          ? 'bg-emerald-600 text-white hover:bg-emerald-700'
                          : status === 'REJECTED'
                            ? 'bg-primary text-white hover:bg-red-700'
                            : 'border border-slate-200 bg-white text-slate-700 hover:border-red-200 hover:text-primary'
                      }`}
                    >
                      Mark {humanizeToken(status).toLowerCase()}
                    </button>
                  ))}
                </div>
              </article>
            ))
          ) : (
            <EmptyState title="No donor reviews in queue" body="Submitted forms will appear here for medical review and office-use completion." />
          )}
        </div>

        <Pagination
          total={reviewData.total}
          skip={reviewFilters.skip}
          take={reviewFilters.take}
          onPrevious={() => setReviewFilters((current) => ({ ...current, skip: Math.max(current.skip - current.take, 0) }))}
          onNext={() => setReviewFilters((current) => ({ ...current, skip: current.skip + current.take }))}
        />
      </SectionShell>

      <SectionShell
        id="reports"
        title="Reports and analytics"
        description="Operational trends, performance visibility, and export-ready reporting for hospital leadership and emergency coordinators."
        action={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={exportPdf} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-primary">
              Export PDF
            </button>
            <button type="button" onClick={exportCsv} className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700">
              Export CSV
            </button>
          </div>
        }
      >
        {reports ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="space-y-6">
              <PanelCard title="Donations by month">
                <MiniBarChart data={reports.donationsByMonth} />
              </PanelCard>
              <PanelCard title="Blood request trends">
                <MiniBarChart data={reports.requestTrends} />
              </PanelCard>
              <PanelCard title="Donor response rates">
                <DonutChart data={reports.donorResponseRates} />
              </PanelCard>
            </div>
            <div className="space-y-6">
              <PanelCard title="Most requested blood types">
                <div className="space-y-3">
                  {reports.mostRequestedBloodTypes.map((item, index) => (
                    <div key={item.bloodType}>
                      <div className="mb-2 flex items-center justify-between text-sm font-semibold text-slate-700">
                        <span>{bloodGroupLabel[item.bloodType] ?? item.bloodType}</span>
                        <span>{item.value}</span>
                      </div>
                      <div className="h-3 rounded-full bg-slate-100">
                        <div
                          className="h-3 rounded-full"
                          style={{
                            width: `${(item.value / Math.max(reports.mostRequestedBloodTypes[0]?.value ?? 1, 1)) * 100}%`,
                            backgroundColor: trendColors[index % trendColors.length],
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </PanelCard>

              <PanelCard title="Hospital request performance">
                <div className="space-y-3">
                  {reports.hospitalPerformance.map((item, index) => (
                    <div
                      key={`${item.hospitalName}-${index}`}
                      className="rounded-2xl border border-slate-100 p-4"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{item.hospitalName}</p>
                        <StatusBadge label={`${item.completionRate}%`} toneKey={item.completionRate >= 80 ? 'stable' : item.completionRate >= 50 ? 'low' : 'critical'} />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">
                        {item.completedRequests} completed of {item.totalRequests} tracked requests
                      </p>
                    </div>
                  ))}
                </div>
              </PanelCard>

              <PanelCard title="Shortage trends">
                <div className="grid gap-3 sm:grid-cols-2">
                  {reports.shortageTrends.map((item) => (
                    <div key={item.bloodGroup} className="rounded-2xl border border-slate-100 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="font-semibold text-slate-900">{bloodGroupLabel[item.bloodGroup] ?? item.bloodGroup}</p>
                        <StatusBadge label={item.status} toneKey={item.status} />
                      </div>
                      <p className="mt-2 text-sm text-slate-500">{item.availableUnits} units available • {item.expiringUnits} expiring</p>
                    </div>
                  ))}
                </div>
              </PanelCard>
            </div>
          </div>
        ) : (
          <LoadingGrid />
        )}
      </SectionShell>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <SectionShell
          id="audit"
          title="Audit log visibility"
          description="Track who changed what, when, and from which module with old/new value support for safe governance."
        >
          <div className="grid gap-3 md:grid-cols-5">
            <input
              value={auditFilters.action}
              onChange={(event) => setAuditFilters((current) => ({ ...current, action: event.target.value, skip: 0 }))}
              placeholder="Action"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            />
            <select
              value={auditFilters.userId}
              onChange={(event) => setAuditFilters((current) => ({ ...current, userId: event.target.value, skip: 0 }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            >
              <option value="">All admins</option>
              {auditData.users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.email}
                </option>
              ))}
            </select>
            <input
              type="date"
              value={auditFilters.from}
              onChange={(event) => setAuditFilters((current) => ({ ...current, from: event.target.value, skip: 0 }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            />
            <input
              type="date"
              value={auditFilters.to}
              onChange={(event) => setAuditFilters((current) => ({ ...current, to: event.target.value, skip: 0 }))}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            />
            <input
              value={auditFilters.module}
              onChange={(event) => setAuditFilters((current) => ({ ...current, module: event.target.value, skip: 0 }))}
              placeholder="Module"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
            />
          </div>

          <div className="mt-5 overflow-x-auto rounded-3xl border border-slate-100">
            <table className="min-w-full bg-white text-sm">
              <thead className="bg-slate-50 text-left text-xs uppercase tracking-[0.25em] text-slate-400">
                <tr>
                  <th className="px-4 py-4">User</th>
                  <th className="px-4 py-4">Action</th>
                  <th className="px-4 py-4">Entity</th>
                  <th className="px-4 py-4">Module</th>
                  <th className="px-4 py-4">IP</th>
                  <th className="px-4 py-4">Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {auditData.items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-100">
                    <td className="px-4 py-4">
                      <p className="font-semibold text-slate-900">{item.actor?.email ?? 'System'}</p>
                      <p className="text-xs text-slate-500">{item.actor?.role ?? 'AUTOMATION'}</p>
                    </td>
                    <td className="px-4 py-4 font-semibold text-slate-900">{item.action}</td>
                    <td className="px-4 py-4 text-slate-600">{item.entityType}{item.entityId ? ` • ${item.entityId}` : ''}</td>
                    <td className="px-4 py-4 text-slate-600">{item.module ?? 'GENERAL'}</td>
                    <td className="px-4 py-4 text-slate-600">{item.ipAddress ?? '—'}</td>
                    <td className="px-4 py-4 text-slate-600">{formatDateTime(item.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Pagination
            total={auditData.total}
            skip={auditFilters.skip}
            take={auditFilters.take}
            onPrevious={() => setAuditFilters((current) => ({ ...current, skip: Math.max(current.skip - current.take, 0) }))}
            onNext={() => setAuditFilters((current) => ({ ...current, skip: current.skip + current.take }))}
          />
        </SectionShell>

        <SectionShell
          id="security"
          title="Security monitoring"
          description="Monitor recent admin access, failed login attempts, suspicious activity, and active session posture."
        >
          {security ? (
            <div className="space-y-5">
              <SecurityList title="Recent admin logins" items={security.recentAdminLogins} />
              <SecurityList title="Failed login attempts" items={security.failedLoginAttempts} />
              <SecurityList title="Suspicious access attempts" items={security.suspiciousAccessAttempts} />
              <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-slate-900">Active sessions</p>
                  <StatusBadge label={`${security.activeSessions.length}`} toneKey="INFO" />
                </div>
                <div className="mt-3 space-y-3">
                  {security.activeSessions.map((session) => (
                    <div key={session.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
                      <p className="font-semibold text-slate-900">{session.email}</p>
                      <p className="mt-1 text-slate-600">{session.role}</p>
                      <p className="mt-1 text-xs text-slate-500">Started {formatDateTime(session.createdAt)} • Expires {formatDateTime(session.expiresAt)}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <LoadingGrid />
          )}
        </SectionShell>
      </div>

      <SectionShell
        id="search"
        title="Global search"
        description="Search donors, hospitals, requests, appointments, and inventory from one admin command bar."
        action={
          <Link to="/admin/website-management" className="rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-primary transition hover:bg-primary hover:text-white">
            Website management shortcut
          </Link>
        }
      >
        <form onSubmit={handleSearch} className="flex flex-col gap-3 md:flex-row">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search donor, hospital, request, appointment, or blood type"
            className="flex-1 rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700 placeholder:text-slate-400"
          />
          <button
            type="submit"
            disabled={searchLoading}
            className="rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70"
          >
            {searchLoading ? 'Searching…' : 'Search operations'}
          </button>
        </form>

        {searchResults ? (
          <div className="mt-5 grid gap-4 lg:grid-cols-2 xl:grid-cols-3">
            <SearchCard title="Donors" count={searchResults.donors.length}>
              {searchResults.donors.length ? (
                searchResults.donors.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{item.fullName}</p>
                    <p className="text-sm text-slate-500">{item.user.email} • {bloodGroupLabel[item.bloodGroup] ?? item.bloodGroup}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No donor matches.</p>
              )}
            </SearchCard>
            <SearchCard title="Hospitals" count={searchResults.hospitals.length}>
              {searchResults.hospitals.length ? (
                searchResults.hospitals.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{item.hospitalName}</p>
                    <p className="text-sm text-slate-500">{item.registrationCode} • {item.location}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No hospital matches.</p>
              )}
            </SearchCard>
            <SearchCard title="Blood requests" count={searchResults.requests.length}>
              {searchResults.requests.length ? (
                searchResults.requests.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{bloodGroupLabel[item.bloodGroup] ?? item.bloodGroup} • {item.hospital.hospitalName}</p>
                    <p className="text-sm text-slate-500">{item.patientName ?? item.patientCode ?? 'Unnamed case'} • {item.location}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No request matches.</p>
              )}
            </SearchCard>
            <SearchCard title="Appointments" count={searchResults.appointments.length}>
              {searchResults.appointments.length ? (
                searchResults.appointments.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{item.donor.fullName}</p>
                    <p className="text-sm text-slate-500">{item.hospital.hospitalName} • {formatDateTime(item.scheduledAt)}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No appointment matches.</p>
              )}
            </SearchCard>
            <SearchCard title="Inventory" count={searchResults.inventory.length}>
              {searchResults.inventory.length ? (
                searchResults.inventory.map((item) => (
                  <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3">
                    <p className="font-semibold text-slate-900">{bloodGroupLabel[item.bloodGroup] ?? item.bloodGroup}</p>
                    <p className="text-sm text-slate-500">{item.hospital.hospitalName} • {item.availableUnits} units</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">No inventory matches.</p>
              )}
            </SearchCard>
            <SearchCard title="Website command lane" count={1}>
              <div className="rounded-2xl bg-slate-50 px-4 py-3">
                <p className="font-semibold text-slate-900">Public website operations</p>
                <p className="mt-1 text-sm text-slate-500">Jump into emergency banners, FAQ content, testimonials, awareness posts, and partner hospitals.</p>
                <Link to="/admin/website-management" className="mt-3 inline-flex rounded-full border border-red-200 px-4 py-2 text-xs font-semibold text-primary transition hover:bg-primary hover:text-white">
                  Open Website Management
                </Link>
              </div>
            </SearchCard>
          </div>
        ) : null}
      </SectionShell>

      {reviewModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-2xl rounded-[28px] bg-white p-6 shadow-2xl">
            <h3 className="text-xl font-bold text-slate-950">
              Confirm {humanizeToken(reviewModal.status).toLowerCase()} for {reviewModal.review.donor.fullName}
            </h3>
            <p className="mt-2 text-sm text-slate-500">
              This will update donor eligibility workflow timestamps, add an audit log, and refresh the live command center.
            </p>
            <div className="mt-5 grid gap-4">
              <textarea
                value={reviewForm.reviewNotes}
                onChange={(event) => setReviewForm((current) => ({ ...current, reviewNotes: event.target.value }))}
                placeholder="Clinical review notes"
                className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
              <textarea
                value={reviewForm.officeUseNotes}
                onChange={(event) => setReviewForm((current) => ({ ...current, officeUseNotes: event.target.value }))}
                placeholder="Office use completion notes"
                className="min-h-28 rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-700"
              />
            </div>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button type="button" onClick={() => setReviewModal(null)} className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={handleReviewUpdate}
                className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-70"
              >
                {busy ? 'Saving…' : 'Confirm update'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex w-full max-w-sm flex-col gap-3">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white'
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </section>
  );
}

function SearchCard({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{title}</p>
        <StatusBadge label={`${count}`} toneKey="INFO" />
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function PanelCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm">
      <h3 className="text-lg font-bold text-slate-900">{title}</h3>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function Pagination({
  total,
  skip,
  take,
  onPrevious,
  onNext,
}: {
  total: number;
  skip: number;
  take: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="mt-5 flex items-center justify-between gap-3">
      <p className="text-sm text-slate-500">
        Showing <span className="font-semibold text-slate-900">{Math.min(skip + 1, total || 0)}</span>–
        <span className="font-semibold text-slate-900">{Math.min(skip + take, total)}</span> of{' '}
        <span className="font-semibold text-slate-900">{total}</span>
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onPrevious}
          disabled={skip === 0}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Previous
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={skip + take >= total}
          className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-red-200 hover:text-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          Next
        </button>
      </div>
    </div>
  );
}

function InfoPair({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-semibold text-slate-900">{value}</p>
    </div>
  );
}

function SecurityList({ title, items }: { title: string; items: SecurityEventItem[] }) {
  return (
    <div className="rounded-3xl border border-slate-100 bg-white p-4 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <p className="font-semibold text-slate-900">{title}</p>
        <StatusBadge label={`${items.length}`} toneKey={items.some((item) => item.severity === 'CRITICAL') ? 'CRITICAL' : 'INFO'} />
      </div>
      <div className="mt-3 space-y-3">
        {items.length ? (
          items.map((item) => (
            <div key={item.id} className="rounded-2xl bg-slate-50 px-4 py-3 text-sm">
              <div className="flex items-center justify-between gap-3">
                <p className="font-semibold text-slate-900">{item.actor?.email ?? item.email ?? 'System event'}</p>
                <StatusBadge label={item.severity} toneKey={item.severity} />
              </div>
              <p className="mt-1 text-slate-600">{item.description}</p>
              <p className="mt-2 text-xs text-slate-500">{item.eventType} • {formatDateTime(item.createdAt)} {item.ipAddress ? `• ${item.ipAddress}` : ''}</p>
            </div>
          ))
        ) : (
          <p className="text-sm text-slate-500">No events recorded yet.</p>
        )}
      </div>
    </div>
  );
}
