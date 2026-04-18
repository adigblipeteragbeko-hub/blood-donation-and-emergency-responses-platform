const statCards = [
  { label: 'Blood Units In Stock', value: '0', note: 'No units added yet' },
  { label: 'Active Requests', value: '0', note: 'Create request to begin' },
  { label: 'Emergency Alerts', value: '0', note: 'No emergency broadcasts' },
  { label: 'Today Appointments', value: '0', note: 'No donor bookings today' },
];

export default function HospitalDashboardPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Hospital Dashboard</h1>
        <p className="text-sm text-muted">Overview of blood stock, active requests, recent activity, and alerts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {statCards.map((item) => (
          <article key={item.label} className="card">
            <p className="text-sm font-semibold text-muted">{item.label}</p>
            <p className="mt-2 text-3xl font-bold text-primary">{item.value}</p>
            <p className="mt-1 text-xs text-muted">{item.note}</p>
          </article>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          <p className="mt-2 text-sm text-muted">No recent activity. Add inventory or create a blood request to begin tracking.</p>
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Alerts</h2>
          <p className="mt-2 text-sm text-muted">No critical alerts. Emergency broadcasts and low-stock alerts will appear here.</p>
        </article>
      </div>
    </section>
  );
}

