export default function NotificationsPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Notifications</h1>
      <ul className="space-y-2">
        <li className="rounded border border-gray-200 p-3">Emergency request matched to your blood group.</li>
        <li className="rounded border border-gray-200 p-3">Appointment reminder for tomorrow at 10:00.</li>
      </ul>
    </section>
  );
}
