import { useState } from 'react';

export default function DonorDashboardPage() {
  const [recentActivity] = useState<string[]>([]);
  const [alerts] = useState<string[]>([]);
  const [donationCount] = useState(0);

  return (
    <section className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-gray-600">Your dashboard will update as you complete donations, appointments, and emergency responses.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Blood Type</p>
          <p className="text-2xl font-bold text-primary">Not set</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Next Eligibility Date</p>
          <p className="text-2xl font-bold text-primary">Not available</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Recent Donations</p>
          <p className="text-2xl font-bold text-primary">{donationCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Open Alerts</p>
          <p className="text-2xl font-bold text-primary">{alerts.length}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="card space-y-2">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-600">No activity yet. Start by completing your profile or booking an appointment.</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {recentActivity.map((item) => (
                <li key={item} className="rounded border border-gray-200 p-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </article>

        <article className="card space-y-2">
          <h2 className="text-lg font-bold text-primary">Alerts</h2>
          {alerts.length === 0 ? (
            <p className="text-sm text-gray-600">No alerts yet.</p>
          ) : (
            <ul className="space-y-2 text-sm text-gray-700">
              {alerts.map((item) => (
                <li key={item} className="rounded border border-red-200 bg-red-50 p-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </article>
      </div>
    </section>
  );
}
