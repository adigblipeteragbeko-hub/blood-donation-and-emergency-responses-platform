import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  getHospitalNotifications,
  markNotificationDelivered,
  NotificationItem,
  respondToMobilizationCampaign,
} from '../services/hospital-portal';
import { AppIcon } from '../components/ui/AppIcon';
import { createRealtimeSocket } from '../services/live-map';
import { useToast } from '../components/ui/ToastProvider';

function extractRequestId(item: NotificationItem) {
  const match = item.body?.match(/requestId=([A-Za-z0-9_-]+)/);
  return match?.[1] ?? null;
}

function actionHref(item: NotificationItem) {
  const requestId = extractRequestId(item);
  if (!requestId) return null;
  return `/donor/emergency-requests?requestId=${requestId}`;
}

function isProactiveDonation(item: NotificationItem) {
  return item.type === 'PROACTIVE_DONATION' || Boolean(item.campaignId);
}

function notificationLabel(item: NotificationItem) {
  if (isProactiveDonation(item)) return 'Emergency Donation Appeal';
  if (!item.type || item.type === 'SYSTEM') return item.delivered ? 'Read' : 'Unread';
  return item.type.replace(/_/g, ' ').toLowerCase();
}

export default function NotificationsPage() {
  const toast = useToast();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const unreadCount = useMemo(() => notifications.filter((item) => !item.delivered).length, [notifications]);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      const data = await getHospitalNotifications({ take: 100 });
      setNotifications(data);
      setMessage('');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to load notifications right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadNotifications();
  }, []);

  useEffect(() => {
    const socket = createRealtimeSocket();
    let refreshTimer: number | null = null;
    const refreshNotifications = () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      refreshTimer = window.setTimeout(() => void loadNotifications(), 250);
    };

    socket.on('notification.created', refreshNotifications);
    return () => {
      if (refreshTimer) window.clearTimeout(refreshTimer);
      socket.off('notification.created', refreshNotifications);
      socket.disconnect();
    };
  }, []);

  const markDelivered = async (notificationId: string) => {
    try {
      await markNotificationDelivered(notificationId, true);
      await loadNotifications();
      window.dispatchEvent(new Event('notifications:changed'));
    } catch (error: any) {
      const text = error?.response?.data?.error?.message ?? 'Unable to update notification.';
      setMessage(text);
      toast.error(text);
    }
  };

  const respondToCampaign = async (campaignId: string, responseStatus: 'INTERESTED' | 'NOT_AVAILABLE') => {
    try {
      const result = await respondToMobilizationCampaign({ campaignId, responseStatus });
      setMessage('');
      toast.success(result.message);
      await loadNotifications();
      window.dispatchEvent(new Event('notifications:changed'));
    } catch (error: any) {
      const text = error?.response?.data?.error?.message ?? 'Unable to submit your response right now.';
      setMessage(text);
      toast.error(text);
    }
  };

  return (
    <section className="mx-auto max-w-4xl space-y-4 px-4 sm:px-6">
      <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-red-600">
          <AppIcon name="notification" className="h-4 w-4" />
          Donor alerts
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Notifications</h1>
        <p className="mt-2 text-sm text-slate-600">
          Emergency alerts, appointment reminders, and system messages linked to your donor account.
        </p>
        <p className="mt-3 text-sm font-semibold text-slate-700">{unreadCount} unread notification(s)</p>
      </div>

      {message ? <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p> : null}

      {loading ? <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading notifications...</p> : null}

      {!loading && notifications.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No notifications yet.</p>
      ) : (
        <ul className="space-y-3">
          {notifications.map((item) => {
            const href = actionHref(item);
            return (
              <li key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950">{item.title}</p>
                    <p className="mt-1 text-sm text-slate-600">{item.body}</p>
                    <p className="mt-2 text-xs font-semibold text-slate-500">{new Date(item.createdAt).toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-black uppercase ${item.delivered ? 'bg-slate-100 text-slate-600' : 'bg-red-50 text-red-700'}`}>
                    {notificationLabel(item)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {isProactiveDonation(item) && item.campaignId ? (
                    <>
                      <button className="btn-primary" onClick={() => void respondToCampaign(item.campaignId!, 'INTERESTED')} type="button">
                        I'm Interested
                      </button>
                      <button
                        className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                        onClick={() => void respondToCampaign(item.campaignId!, 'NOT_AVAILABLE')}
                        type="button"
                      >
                        Not Available
                      </button>
                      <span className="rounded-lg bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-500">
                        Appointment scheduling is coordinated by hospital staff.
                      </span>
                    </>
                  ) : null}
                  {href ? (
                    <Link className="btn-primary" to={href}>
                      View Alert
                    </Link>
                  ) : null}
                  {!item.delivered ? (
                    <button className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700" onClick={() => void markDelivered(item.id)} type="button">
                      Mark as read
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
