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
        const response = await api.get('/public/emergency-requests?take=10');
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
    return () => {
      mounted = false;
      window.clearInterval(timer);
      socket.off('emergency.request.updated', loadAlerts);
      socket.disconnect();
    };
  }, []);

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
      className="group flex flex-col gap-3 rounded-2xl border border-red-200 bg-gradient-to-r from-red-700 to-primary px-5 py-4 text-white shadow-lg shadow-red-900/10 transition hover:-translate-y-0.5 hover:shadow-xl md:flex-row md:items-center md:justify-between"
      to={targetHref}
    >
      <div>
        <p className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.22em] text-red-100">
          <AppIcon name="alert" className="h-3.5 w-3.5" />
          Live emergency
        </p>
        <p className="mt-1 text-base font-extrabold md:text-lg">
          {bloodType} needed at {hospital}
        </p>
        <p className="text-sm text-red-50">
          {units > 0 ? `${units} unit${units === 1 ? '' : 's'} requested` : 'Urgent blood coordination needed'}.
        </p>
        {activeAlert.requiredBy ? (
          <p className="text-xs text-red-100">Required by: {new Date(activeAlert.requiredBy).toLocaleString()}</p>
        ) : null}
        <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-wide">
          <span className="rounded-full border border-white/30 bg-white/15 px-2 py-1">{urgency}</span>
          <span className="rounded-full border border-white/30 bg-white/15 px-2 py-1">{status}</span>
        </div>
      </div>
      <span className="inline-flex w-fit items-center gap-2 rounded-full border border-white/30 px-4 py-2 text-sm font-bold transition group-hover:bg-white group-hover:text-primary animate-pulse">
        <AppIcon name="notification" className="h-4 w-4" />
        View details
      </span>
    </Link>
  );
}
