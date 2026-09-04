import { useEffect, useMemo, useState } from 'react';
import {
  NotificationItem,
  getHospitalNotifications,
  markNotificationDelivered,
} from '../services/hospital-portal';
import { FilterBox, Pager } from '../components/TableControls';
import { useToast } from '../components/ui/ToastProvider';

export default function HospitalNotificationsPage() {
  const toast = useToast();
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 25;

  const load = async (nextPage = page) => {
    try {
      const data = await getHospitalNotifications({ skip: nextPage * pageSize, take: pageSize });
      setItems(data);
      setHasMore(data.length === pageSize);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !searchTerm ||
          item.title.toLowerCase().includes(searchTerm) ||
          item.body.toLowerCase().includes(searchTerm) ||
          (item.delivered ? 'delivered' : 'pending').includes(searchTerm),
      ),
    [items, searchTerm],
  );

  const markDelivered = async (notificationId: string) => {
    setMessage('');
    try {
      await markNotificationDelivered(notificationId, true);
      toast.success('Notification marked as read.');
      await load();
    } catch (error: any) {
      const text = error?.response?.data?.error?.message ?? 'Failed to update notification.';
      setMessage(text);
      toast.error(text);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Notifications</h1>
        <p className="text-sm text-muted">Review donor responses, system updates, and emergency alerts.</p>
      </div>
      <FilterBox
        label="Filter notifications (debounced)"
        placeholder="Filter by title/body/status..."
        value={searchInput}
        onChange={setSearchInput}
      />

      {message ? <p className="text-sm font-semibold text-primary">{message}</p> : null}

      <div className="card space-y-3">
        {loading ? <p className="text-sm text-muted">Loading notifications...</p> : null}
        {!loading && filteredItems.length === 0 ? <p className="text-sm text-muted">No notifications right now.</p> : null}
        {!loading &&
          filteredItems.map((item) => (
            <article key={item.id} className="rounded border border-red-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-base font-bold text-primary">{item.title}</h2>
                <span className="text-xs text-muted">{new Date(item.createdAt).toLocaleString()}</span>
              </div>
              <p className="mt-1 text-sm text-gray-700">{item.body}</p>
              <div className="mt-3 flex items-center gap-2">
                <span className={`rounded px-2 py-1 text-xs font-semibold ${item.delivered ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>
                  {item.delivered ? 'Read' : 'Unread'}
                </span>
                {!item.delivered ? (
                  <button className="rounded border border-primary px-3 py-1 text-xs font-semibold text-primary" onClick={() => void markDelivered(item.id)} type="button">
                    Mark as read
                  </button>
                ) : null}
              </div>
            </article>
          ))}
        <Pager
          page={page}
          hasMore={hasMore}
          onPrev={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => setPage((value) => value + 1)}
        />
      </div>
    </section>
  );
}
