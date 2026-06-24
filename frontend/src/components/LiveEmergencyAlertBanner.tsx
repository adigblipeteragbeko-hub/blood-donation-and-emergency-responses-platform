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

export function LiveEmergencyAlertBanner() {
  const location = useLocation();
  const [alerts, setAlerts] = useState<EmergencyAlertItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadAlerts = async () => {
      try {
        const endpoint = location.pathname.startsWith('/donor')
          ? '/blood-requests/donor-emergency?take=10'
          : '/public/emergency-requests?take=10';
        const response = await api.get(endpoint);
        if (mounted) {
          setAlerts(normalizeList(response.data));
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

  const activeAlert = useMemo(
    () =>
      alerts.find((alert) => {
        const priority = String(alert.priority ?? alert.urgencyLevel ?? '').toUpperCase();
        const status = String(alert.status ?? alert.trackingStatus ?? '').toUpperCase();
        return (
          ['CRITICAL', 'HIGH', 'URGENT'].includes(priority) &&
          !['FULFILLED', 'COMPLETED', 'CANCELLED', 'CANCELED'].includes(status)
        );
      }),
    [alerts],
  );

  if (!activeAlert) return null;

  const bloodType = bloodGroupLabel[activeAlert.bloodGroup ?? activeAlert.bloodType ?? ''] ?? activeAlert.bloodGroup ?? activeAlert.bloodType ?? 'Blood';
  const hospital = activeAlert.hospital?.name ?? activeAlert.hospital?.hospitalName ?? 'partner hospital';
  const units = activeAlert.unitsNeeded ?? 0;
  const urgency = String(activeAlert.priority ?? activeAlert.urgencyLevel ?? 'CRITICAL').toUpperCase();
  const status = String(activeAlert.status ?? activeAlert.trackingStatus ?? 'ACTIVE').toUpperCase();
  const targetHref = location.pathname.startsWith('/hospital')
    ? `/hospital/active-requests?requestId=${activeAlert.id}`
    : location.pathname.startsWith('/donor')
      ? `/donor/emergency-requests?requestId=${activeAlert.id}`
      : location.pathname.startsWith('/admin')
        ? `/admin/management?section=request-tracking&requestId=${activeAlert.id}`
        : `/emergency-requests?requestId=${activeAlert.id}`;

  return (
    <Link
      className="group flex flex-col gap-4 rounded-3xl border border-red-200 bg-gradient-to-r from-red-800 via-red-700 to-primary px-5 py-4 text-white shadow-xl shadow-red-900/10 transition hover:-translate-y-0.5 hover:shadow-2xl md:flex-row md:items-center md:justify-between"
      to={targetHref}
    >
      <div className="flex items-start gap-4">
        <span className="mt-1 rounded-2xl bg-white/15 p-3 ring-1 ring-white/20">
          <AppIcon name="alert" className="h-5 w-5" />
        </span>
        <div>
          <p className="text-xs font-black uppercase tracking-[0.24em] text-red-100">Live Emergency</p>
          <p className="mt-1 text-xl font-black leading-tight md:text-2xl">{bloodType} Blood Needed</p>
          <p className="mt-1 text-sm font-semibold text-red-50">{hospital}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs font-bold">
            <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">
              {units > 0 ? `${units} unit${units === 1 ? '' : 's'} requested` : 'Urgent coordination'}
            </span>
            <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">{urgency}</span>
            <span className="rounded-full border border-white/25 bg-white/15 px-3 py-1">{status}</span>
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
      </div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white px-5 py-2.5 text-sm font-black text-primary shadow-sm transition group-hover:scale-105 group-hover:bg-red-50">
        <AppIcon name="notification" className="h-4 w-4" />
        View Details
      </span>
    </Link>
  );
}
