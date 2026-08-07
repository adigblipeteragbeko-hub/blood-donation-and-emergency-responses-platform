import { useEffect, useState } from 'react';
import api from '../services/api';
import { bloodGroups } from '../constants/blood-groups';
import { AppIcon } from '../components/ui/AppIcon';
import { SmartAvatar } from '../components/SmartAvatar';
import { createRealtimeSocket } from '../services/live-map';

type DonorProfilePayload = {
  fullName?: string | null;
  firstName?: string | null;
  otherNames?: string | null;
  surname?: string | null;
  donorNumber?: string | null;
  profileImageUrl?: string | null;
  bloodGroup?: string;
  donationHistory?: Array<{ donationNumber?: string | null; donatedAt: string; notes?: string | null; unitsDonated?: number | null }>;
  availabilityStatus?: boolean;
};

type EligibilityStatusPayload = {
  healthFormCompleted?: boolean;
  healthFormSubmitted?: boolean;
  canSetAvailable?: boolean;
  reason?: string;
  reviewStatus?: string | null;
};

type NotificationPayload = {
  id: string;
  createdAt: string;
  title: string;
  body?: string | null;
  delivered?: boolean;
  type?: string | null;
  campaignId?: string | null;
};

const bloodGroupLabel = Object.fromEntries(bloodGroups.map((item) => [item.value, item.label]));

const detailFromNotes = (notes: string | null | undefined, label: string) => {
  const match = notes?.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'));
  return match?.[1]?.trim() ?? '';
};

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const isMobilizationNotification = (item: NotificationPayload) =>
  item.type === 'PROACTIVE_DONATION' || Boolean(item.campaignId);

const isOpenAlert = (item: NotificationPayload) =>
  !item.delivered && ['EMERGENCY_REQUEST', 'PROACTIVE_DONATION', 'APPOINTMENT', 'INVENTORY_ALERT'].includes(item.type ?? '');

const alertTitle = (item: NotificationPayload) =>
  isMobilizationNotification(item) ? `Emergency Donation Appeal: ${item.title}` : item.title;

const activityText = (item: NotificationPayload) =>
  isMobilizationNotification(item)
    ? item.body || `Emergency donor mobilization alert received: ${item.title}`
    : `Alert received: ${item.title}`;

export default function DonorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [bloodGroup, setBloodGroup] = useState('Not set');
  const [bloodGroupUnknown, setBloodGroupUnknown] = useState(false);
  const [donationCount, setDonationCount] = useState(0);
  const [availability, setAvailability] = useState('Not set');
  const [alerts, setAlerts] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<string[]>([]);
  const [eligibility, setEligibility] = useState<EligibilityStatusPayload | null>(null);
  const [donorName, setDonorName] = useState('Donor');
  const [donorReference, setDonorReference] = useState<string | null>(null);
  const [profileImageUrl, setProfileImageUrl] = useState<string | null>(null);

  const applyNotifications = (items: NotificationPayload[]) => {
    const sorted = [...items].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    const openAlerts = sorted.filter(isOpenAlert);
    setAlerts(openAlerts.slice(0, 5).map(alertTitle));
    if (sorted.length > 0) {
      setRecentActivity((prev) => {
        const next = [...sorted.slice(0, 5).map(activityText), ...prev];
        return Array.from(new Set(next)).slice(0, 5);
      });
    }
  };

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [profileRes, notificationsRes, eligibilityRes] = await Promise.allSettled([
          api.get('/donors/profile'),
          api.get('/notifications'),
          api.get('/donors/eligibility/status'),
        ]);

        if (profileRes.status === 'fulfilled') {
          const profile = (profileRes.value.data?.data ?? profileRes.value.data ?? {}) as DonorProfilePayload;
          const name = profile.fullName?.trim() || [profile.firstName, profile.otherNames, profile.surname].filter(Boolean).join(' ').trim();
          setDonorName(name || 'Donor');
          setDonorReference(profile.donorNumber ?? null);
          setProfileImageUrl(profile.profileImageUrl ?? null);
          if (profile.bloodGroup) {
            setBloodGroup(bloodGroupLabel[profile.bloodGroup] ?? profile.bloodGroup);
            setBloodGroupUnknown(profile.bloodGroup === 'UNKNOWN');
          }
          setDonationCount(profile.donationHistory?.length ?? 0);
          if (typeof profile.availabilityStatus === 'boolean') {
            setAvailability(profile.availabilityStatus ? 'Available' : 'Not Available');
          }
          const donationEvents = (profile.donationHistory ?? [])
            .slice(0, 3)
            .map((entry) => {
              const reference = detailFromNotes(entry.notes, 'Appointment');
              const donationNumber = entry.donationNumber ? `${entry.donationNumber}: ` : '';
              const units = entry.unitsDonated ?? 1;
              return `${donationNumber}${reference ? `${reference}: ` : ''}${units} unit${units === 1 ? '' : 's'} donated on ${new Date(entry.donatedAt).toLocaleDateString()}`;
            });
          setRecentActivity(donationEvents);
        }

        if (notificationsRes.status === 'fulfilled') {
          const notifications = (notificationsRes.value.data?.data ?? notificationsRes.value.data ?? []) as NotificationPayload[];
          applyNotifications(notifications);
        }
        if (eligibilityRes.status === 'fulfilled') {
          setEligibility(eligibilityRes.value.data?.data ?? eligibilityRes.value.data ?? null);
        }
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  useEffect(() => {
    const socket = createRealtimeSocket();
    let refreshTimer: number | null = null;
    const refreshNotifications = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(async () => {
        const response = await api.get('/notifications');
        applyNotifications((response.data?.data ?? response.data ?? []) as NotificationPayload[]);
      }, 250);
    };

    socket.on('notification.created', refreshNotifications);
    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      socket.off('notification.created', refreshNotifications);
      socket.disconnect();
    };
  }, []);

  return (
    <section className="space-y-4">
      <div className="card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <SmartAvatar name={donorName} src={profileImageUrl} size="lg" />
            <div>
              <p className="text-sm font-bold uppercase tracking-wide text-muted">Donor Dashboard</p>
              <h1 className="text-2xl font-bold text-primary">{greeting()}, {donorName.split(' ')[0]}</h1>
              <p className="text-sm text-gray-600">Your latest donation, availability, and alerts.</p>
            </div>
          </div>
          <span className="rounded-2xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-black text-primary">
            {donorReference ?? 'Donor reference pending'}
          </span>
        </div>
      </div>

      {!loading && eligibility && !eligibility.canSetAvailable ? (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-bold">Eligibility reminder</p>
          <p className="mt-1">{eligibility.reason ?? 'Complete your Health Eligibility Form and hospital review before becoming available for emergency matching.'}</p>
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Blood Group</p>
          <p className="text-2xl font-bold text-primary">{loading ? 'Loading...' : bloodGroup}</p>
          {!loading && bloodGroupUnknown ? <p className="mt-2 rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">Pending hospital confirmation</p> : null}
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Availability</p>
          <p className="text-2xl font-bold text-primary">{loading ? 'Loading...' : availability}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Donations</p>
          <p className="text-2xl font-bold text-primary">{loading ? '...' : donationCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Open Alerts</p>
          <p className="text-2xl font-bold text-primary">{loading ? '...' : alerts.length}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="card space-y-2">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-600">No recent activity yet. Appointment updates, donations, and notifications will appear here.</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {recentActivity.map((item) => (
                <li key={item} className="rounded border border-gray-200 p-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card space-y-2">
          <h2 className="text-lg font-bold text-primary">Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-600">No alerts right now. Emergency requests and appointment reminders will appear here.</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
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
