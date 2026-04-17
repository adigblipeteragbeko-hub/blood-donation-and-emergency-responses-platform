const notifications = [
  { id: 1, type: 'Emergency', message: 'Critical O_NEG request near your location.' },
  { id: 2, type: 'Reminder', message: 'Appointment reminder for April 22 at 10:00 AM.' },
  { id: 3, type: 'Message', message: 'Thank you for your last donation. You earned a new badge.' },
];

export default function NotificationsPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Notifications</h1>
      <p className="text-sm text-gray-600">Alerts for emergencies, reminders, and messages.</p>
      <ul className="space-y-2">
        {notifications.map((item) => (
          <li key={item.id} className="rounded border border-gray-200 p-3 text-sm">
            <span className="mr-2 rounded bg-red-100 px-2 py-1 text-xs font-semibold text-primary">{item.type}</span>
            {item.message}
          </li>
        ))}
      </ul>
    </section>
  );
}
