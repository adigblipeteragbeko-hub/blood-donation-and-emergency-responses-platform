import { useEffect, useState } from 'react';
import {
  getHospitalAppointments,
  getHospitalInventory,
  getHospitalNotifications,
  getHospitalRequests,
} from '../services/hospital-portal';

export default function HospitalDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [stockUnits, setStockUnits] = useState(0);
  const [activeRequests, setActiveRequests] = useState(0);
  const [todayAppointments, setTodayAppointments] = useState(0);
  const [alerts, setAlerts] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<string[]>([]);

  useEffect(() => {
    const load = async () => {
      try {
        const [inventory, requests, appointments, notifications] = await Promise.all([
          getHospitalInventory(),
          getHospitalRequests(),
          getHospitalAppointments(),
          getHospitalNotifications(),
        ]);

        setStockUnits(inventory.reduce((sum, item) => sum + item.availableUnits, 0));
        setActiveRequests(requests.filter((item) => item.status === 'OPEN' || item.status === 'MATCHING').length);

        const today = new Date().toDateString();
        setTodayAppointments(
          appointments.filter((item) => new Date(item.scheduledAt).toDateString() === today).length,
        );

        const topAlerts = notifications
          .slice(0, 4)
          .map((item) => `${item.title} (${new Date(item.createdAt).toLocaleDateString()})`);
        setAlerts(topAlerts);

        const activity = requests.slice(0, 4).map(
          (item) => `${item.bloodGroup} request: ${item.unitsNeeded} units (${item.status})`,
        );
        setRecentActivity(activity);
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Hospital Dashboard</h1>
        <p className="text-sm text-muted">Overview of blood stock, active requests, recent activity, and alerts.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="card">
          <p className="text-sm font-semibold text-muted">Blood Units In Stock</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : stockUnits}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Active Requests</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : activeRequests}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Today Appointments</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : todayAppointments}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Alerts</p>
          <p className="mt-2 text-3xl font-bold text-primary">{loading ? '...' : alerts.length}</p>
        </article>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No recent activity yet.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
              {recentActivity.map((item) => (
                <li key={item} className="rounded border border-gray-200 p-2">
                  {item}
                </li>
              ))}
            </ul>
          )}
        </article>
        <article className="card">
          <h2 className="text-lg font-bold text-primary">Alerts</h2>
          {alerts.length === 0 ? (
            <p className="mt-2 text-sm text-muted">No alerts right now.</p>
          ) : (
            <ul className="mt-2 space-y-2 text-sm">
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

