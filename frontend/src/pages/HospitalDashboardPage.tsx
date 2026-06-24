import { useEffect, useState } from 'react';
import {
  type AppointmentItem,
  type BloodRequestItem,
  type HospitalProfile,
  type InventoryItem,
  type InventoryLogItem,
  type NotificationItem,
  getHospitalAppointments,
  getHospitalInventory,
  getInventoryLogs,
  getHospitalProfile,
  getHospitalNotifications,
  getHospitalRequests,
  getHospitalRequestHistory,
} from '../services/hospital-portal';
import { AppIcon } from '../components/ui/AppIcon';

type RecentActivityItem = {
  id: string;
  title: string;
  timestamp?: string | null;
};

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

export default function HospitalDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loadWarning, setLoadWarning] = useState<string | null>(null);
  const [profile, setProfile] = useState<HospitalProfile | null>(null);
  const [stockUnits, setStockUnits] = useState(0);
  const [activeRequests, setActiveRequests] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivityItem[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [profileResult, inventoryResult, inventoryLogsResult, requestsResult, historyResult, appointmentsResult, notificationsResult] = await Promise.allSettled([
          getHospitalProfile(),
          getHospitalInventory(),
          getInventoryLogs({ skip: 0, take: 20 }),
          getHospitalRequests(),
          getHospitalRequestHistory({ skip: 0, take: 20 }),
          getHospitalAppointments(),
          getHospitalNotifications(),
        ]);

        const loadedProfile = getSettledValue<HospitalProfile | null>(profileResult, null);
        const inventory = getSettledValue<InventoryItem[]>(inventoryResult, []);
        const inventoryLogs = getSettledValue<InventoryLogItem[]>(inventoryLogsResult, []);
        const requests = getSettledValue<BloodRequestItem[]>(requestsResult, []);
        const requestHistory = getSettledValue<BloodRequestItem[]>(historyResult, []);
        const appointments = getSettledValue<AppointmentItem[]>(appointmentsResult, []);
        const notifications = getSettledValue<NotificationItem[]>(notificationsResult, []);
        const failedSections = [
          profileResult.status === 'rejected' ? 'profile' : null,
          inventoryResult.status === 'rejected' ? 'inventory' : null,
          inventoryLogsResult.status === 'rejected' ? 'inventory logs' : null,
          requestsResult.status === 'rejected' ? 'requests' : null,
          historyResult.status === 'rejected' ? 'request history' : null,
          appointmentsResult.status === 'rejected' ? 'appointments' : null,
          notificationsResult.status === 'rejected' ? 'notifications' : null,
        ].filter(Boolean);
        setLoadWarning(
          failedSections.length > 0
            ? `Some dashboard sections could not load: ${failedSections.join(', ')}.`
            : null,
        );

        setProfile(loadedProfile);

        const stockItems = inventory.length > 0 ? inventory : (loadedProfile?.inventoryItems ?? []);
        setStockUnits(stockItems.reduce((sum, item) => sum + Number(item.availableUnits ?? 0), 0));
        setActiveRequests(requests.filter((item) => item.status === 'OPEN' || item.status === 'MATCHING').length);

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
  }, []);

  return (
    <section className="space-y-5">
      <div className="card">
        {profile ? (
          <p className="mb-1 text-sm font-semibold text-slate-700">
            Logged in as: <span className="text-slate-950">{profile.hospitalName}</span>
            {profile.city || profile.region ? (
              <span className="text-muted"> - {[profile.city, profile.region].filter(Boolean).join(', ')}</span>
            ) : null}
          </p>
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
      </div>

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

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No recent activity yet.</p>
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
          <h2 className="text-lg font-bold text-primary">Alerts</h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No alerts right now.</p>
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
