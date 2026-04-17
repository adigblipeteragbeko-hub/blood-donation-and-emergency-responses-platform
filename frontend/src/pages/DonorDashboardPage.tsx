const recentActivity = [
  'Appointment booked at City Hospital for Apr 22',
  'Emergency alert accepted for O_NEG request',
  'Profile location updated to Accra Central',
];

const activeAlerts = [
  'Critical O_NEG request near you (3.4 km away).',
  'Your eligibility will renew in 8 days.',
];

export default function DonorDashboardPage() {
  return (
    <section className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-gray-600">Overview of profile, next eligibility date, recent activity, and alerts.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Blood Type</p>
          <p className="text-2xl font-bold text-primary">O_POS (O+)</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Next Eligibility Date</p>
          <p className="text-2xl font-bold text-primary">Apr 25, 2026</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Recent Donations</p>
          <p className="text-2xl font-bold text-primary">4</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Open Alerts</p>
          <p className="text-2xl font-bold text-primary">2</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="card space-y-2">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {recentActivity.map((item) => (
              <li key={item} className="rounded border border-gray-200 p-2">
                {item}
              </li>
            ))}
          </ul>
        </article>

        <article className="card space-y-2">
          <h2 className="text-lg font-bold text-primary">Alerts</h2>
          <ul className="space-y-2 text-sm text-gray-700">
            {activeAlerts.map((item) => (
              <li key={item} className="rounded border border-red-200 bg-red-50 p-2">
                {item}
              </li>
            ))}
          </ul>
        </article>
      </div>
    </section>
  );
}
