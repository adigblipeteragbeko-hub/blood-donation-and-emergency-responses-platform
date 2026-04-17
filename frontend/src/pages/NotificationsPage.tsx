import { useState } from 'react';

type Notice = { id: number; type: string; message: string };

export default function NotificationsPage() {
  const [notifications] = useState<Notice[]>([]);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Notifications</h1>
      <p className="text-sm text-gray-600">Alerts for emergencies, reminders, and messages.</p>
      {notifications.length === 0 ? (
        <p className="rounded border border-gray-200 p-3 text-sm text-gray-600">No notifications yet.</p>
      ) : (
        <ul className="space-y-2">
          {notifications.map((item) => (
            <li key={item.id} className="rounded border border-gray-200 p-3 text-sm">
              <span className="mr-2 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-primary">{item.type}</span>
              {item.message}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
