import { useEffect, useState } from 'react';
import {
  NotificationItem,
  getHospitalNotifications,
  markNotificationDelivered,
} from '../services/hospital-portal';

export default function HospitalNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const data = await getHospitalNotifications();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const markDelivered = async (notificationId: string) => {
    setMessage('');
    try {
      await markNotificationDelivered(notificationId, true);
      setMessage('Notification marked as delivered.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to update notification.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Notifications</h1>
        <p className="text-sm text-muted">Review donor responses, system updates, and emergency alerts.</p>
      </div>

      {message ? <p className="text-sm text-primary">{message}</p> : null}

      <div className="card space-y-3">
        {loading ? <p className="text-sm text-muted">Loading notifications...</p> : null}
        {!loading && items.length === 0 ? <p className="text-sm text-muted">No notifications right now.</p> : null}
        {!loading &&
          items.map((item) => (
            <article key={item.id} className="rounded border border-red-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-primary">{item.title}</h2>
                <span className="text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{item.body}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`rounded px-2 py-1 text-xs font-semibold ${item.delivered ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {item.delivered ? 'Delivered' : 'Pending'}
                </span>
                {!item.delivered ? (
                  <button className="rounded border border-primary px-3 py-1 text-xs font-semibold text-primary" onClick={() => void markDelivered(item.id)} type="button">
                    Mark Delivered
                  </button>
                ) : null}
              </div>
            </article>
          ))}
      </div>
    </section>
  );
}

