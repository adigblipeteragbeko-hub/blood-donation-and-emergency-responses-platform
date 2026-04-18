export default function HospitalNotificationsPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Notifications</h1>
        <p className="text-sm text-muted">Review donor responses, system updates, and emergency alerts.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-primary">Inbox</h2>
        <p className="mt-2 text-sm text-muted">No new notifications at this time.</p>
      </div>
    </section>
  );
}

