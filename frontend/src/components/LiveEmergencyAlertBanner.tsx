import { useEffect, useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import { createRealtimeSocket } from '../services/live-map';
import { AppIcon } from './ui/AppIcon';

type EmergencyAlertItem = {
  id: string;
  bloodGroup?: string;
  bloodType?: string;
  unitsNeeded?: number;
  priority?: string;
  urgencyLevel?: string;
  status?: string;
  trackingStatus?: string;
  emergencyNotificationStatus?: 'ACTIVE' | 'EXPIRED' | 'RESOLVED' | 'CANCELLED' | string | null;
  emergencyNotificationExpiresAt?: string | null;
  emergencyNotificationDurationMinutes?: number | null;
  requiredBy?: string;
  hospital?: {
    name?: string;
    hospitalName?: string;
    location?: string;
  };
};

const bloodGroupLabel: Record<string, string> = {
  O_POS: 'O+',
  O_NEG: 'O-',
  A_POS: 'A+',
  A_NEG: 'A-',
  B_POS: 'B+',
  B_NEG: 'B-',
  AB_POS: 'AB+',
  AB_NEG: 'AB-',
};

function normalizeList(payload: unknown): EmergencyAlertItem[] {
  const unwrapped = (payload as { data?: unknown })?.data ?? payload;
  if (Array.isArray(unwrapped)) return unwrapped as EmergencyAlertItem[];
  if (unwrapped && typeof unwrapped === 'object' && Array.isArray((unwrapped as { data?: unknown }).data)) {
    return (unwrapped as { data: EmergencyAlertItem[] }).data;
  }
  return [];
}

function getExpiryTime(alert: EmergencyAlertItem) {
  const value = alert.emergencyNotificationExpiresAt;
  if (!value) return Number.POSITIVE_INFINITY;
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : Number.POSITIVE_INFINITY;
}

function formatExpiryRemaining(milliseconds: number) {
  const totalMinutes = Math.max(0, Math.ceil(milliseconds / 60000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

export function LiveEmergencyAlertBanner() {
  const location = useLocation();
  const [alerts, setAlerts] = useState<EmergencyAlertItem[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let mounted = true;

    const loadAlerts = async () => {
      try {
        const endpoint = location.pathname.startsWith('/donor')
          ? '/blood-requests/donor-emergency?take=10'
          : '/public/emergency-requests?take=10';
        const response = await api.get(endpoint);
        if (mounted) {
          const nextAlerts = normalizeList(response.data);
          const deduped = Array.from(new Map(nextAlerts.map((alert) => [alert.id, alert])).values());
          setAlerts(deduped);
        }
      } catch {
        if (mounted) {
          setAlerts([]);
        }
      }
    };

    void loadAlerts();
    const timer = window.setInterval(loadAlerts, 30000);
    const socket = createRealtimeSocket();
    socket.on('emergency.request.updated', loadAlerts);
    socket.on('emergency.request.public.updated', loadAlerts);
    return () => {
      mounted = false;
      window.clearInterval(timer);
      socket.off('emergency.request.updated', loadAlerts);
      socket.off('emergency.request.public.updated', loadAlerts);
      socket.disconnect();
    };
  }, [location.pathname]);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 30000);
    return () => window.clearInterval(timer);
  }, []);

  const activeAlerts = useMemo(
    () =>
      alerts.filter((alert) => {
        const priority = String(alert.priority ?? alert.urgencyLevel ?? '').toUpperCase();
        const status = String(alert.status ?? alert.trackingStatus ?? '').toUpperCase();
        const notificationStatus = String(alert.emergencyNotificationStatus ?? 'ACTIVE').toUpperCase();
        return (
          ['CRITICAL', 'HIGH', 'URGENT'].includes(priority) &&
          !['FULFILLED', 'COMPLETED', 'CANCELLED', 'CANCELED'].includes(status) &&
          notificationStatus === 'ACTIVE' &&
          now < getExpiryTime(alert)
        );
      }),
    [alerts, now],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [activeAlerts.length]);

  useEffect(() => {
    if (paused || activeAlerts.length <= 1) return;
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % activeAlerts.length);
    }, 6000);
    return () => window.clearInterval(timer);
  }, [activeAlerts.length, paused]);

  const activeAlert = activeAlerts[activeIndex] ?? activeAlerts[0];
  if (!activeAlert) return null;

  const canResolve = location.pathname.startsWith('/hospital') || location.pathname.startsWith('/admin');
  const bloodType = bloodGroupLabel[activeAlert.bloodGroup ?? activeAlert.bloodType ?? ''] ?? activeAlert.bloodGroup ?? activeAlert.bloodType ?? 'Blood';
  const hospital = activeAlert.hospital?.name ?? activeAlert.hospital?.hospitalName ?? 'partner hospital';
  const units = activeAlert.unitsNeeded ?? 0;
  const urgency = String(activeAlert.priority ?? activeAlert.urgencyLevel ?? 'CRITICAL').toUpperCase();
  const status = String(activeAlert.emergencyNotificationStatus ?? activeAlert.status ?? activeAlert.trackingStatus ?? 'ACTIVE').toUpperCase();
  const expiryTime = getExpiryTime(activeAlert);
  const expiryRemaining = expiryTime - now;
  const hasExpiry = Number.isFinite(expiryTime);
  const expiryIsUrgent = hasExpiry && expiryRemaining <= 10 * 60 * 1000;
  const targetHref = location.pathname.startsWith('/hospital')
    ? `/hospital/active-requests?requestId=${activeAlert.id}`
    : location.pathname.startsWith('/donor')
      ? `/donor/emergency-requests?requestId=${activeAlert.id}`
      : location.pathname.startsWith('/admin')
        ? `/admin/management?section=request-tracking&requestId=${activeAlert.id}`
        : `/emergency-requests?requestId=${activeAlert.id}`;
  const resolveAlert = async () => {
    if (!activeAlert || resolvingId) return;
    setResolvingId(activeAlert.id);
    setError('');
    try {
      await api.patch(`/blood-requests/${activeAlert.id}/emergency-notification/resolve`);
      setAlerts((current) =>
        current.map((alert) =>
          alert.id === activeAlert.id ? { ...alert, emergencyNotificationStatus: 'RESOLVED' } : alert,
        ),
      );
    } catch (resolveError: any) {
      setError(resolveError?.response?.data?.error?.message ?? 'Unable to resolve this emergency alert.');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div
      className="rounded-3xl border border-red-200 bg-gradient-to-r from-red-800 via-red-700 to-primary px-5 py-4 text-white shadow-xl shadow-red-900/10"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <Link
          className="group flex min-w-0 flex-1 items-start gap-4 transition hover:-translate-y-0.5"
          to={targetHref}
        >
          <span className="mt-1 rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
            <AppIcon name="alert" className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-black uppercase tracking-[0.24em] text-red-100">
              Live Emergency {activeAlerts.length > 1 ? `${activeIndex + 1} of ${activeAlerts.length}` : ''}
            </p>
            <p className="mt-1 text-xl font-black leading-tight md:text-2xl">{bloodType} Blood Needed</p>
            <p className="mt-1 text-sm font-semibold text-red-50">{hospital}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
              <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">
                {units > 0 ? `${units} unit${units === 1 ? '' : 's'} requested` : 'Urgent coordination'}
              </span>
              <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">{urgency}</span>
              <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">{status}</span>
              {hasExpiry ? (
                <span
                  className={`rounded-full border px-3 py-1 ${
                    expiryIsUrgent ? 'border-amber-200 bg-amber-200 text-red-950' : 'border-white/25 bg-white/15'
                  }`}
                >
                  Expires in {formatExpiryRemaining(expiryRemaining)}
                </span>
              ) : null}
              {activeAlert.requiredBy ? (
                <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">
                  Required by: {new Date(activeAlert.requiredBy).toLocaleString('en-GB', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
              ) : null}
            </div>
          </div>
        </Link>
        <div className="flex flex-wrap items-center gap-2">
          {activeAlerts.length > 1 ? (
            <>
              <button
                className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-black transition hover:bg-white/20"
                type="button"
                onClick={() => setActiveIndex((current) => (current - 1 + activeAlerts.length) % activeAlerts.length)}
              >
                Previous
              </button>
              <button
                className="rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-black transition hover:bg-white/20"
                type="button"
                onClick={() => setActiveIndex((current) => (current + 1) % activeAlerts.length)}
              >
                Next
              </button>
            </>
          ) : null}
          <Link
            className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white px-5 py-2.5 text-sm font-black text-primary shadow-sm transition hover:scale-105 hover:bg-red-50"
            to={targetHref}
          >
            <AppIcon name="notification" className="h-4 w-4" />
            View Details
          </Link>
          {canResolve ? (
            <button
              aria-label={`Mark emergency alert for ${bloodType} at ${hospital} as resolved`}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/10 px-4 py-2.5 text-sm font-black text-white shadow-sm transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white/70 disabled:cursor-not-allowed disabled:opacity-60"
              disabled={resolvingId === activeAlert.id}
              type="button"
              onClick={resolveAlert}
            >
              {resolvingId === activeAlert.id ? 'Resolving...' : 'Mark Resolved'}
            </button>
          ) : null}
        </div>
      </div>
      {error ? <p className="mt-3 text-sm font-bold text-red-50" role="alert">{error}</p> : null}
    </div>
  );
}
