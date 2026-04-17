import { useEffect, useState } from 'react';
import api from '../services/api';
import { bloodGroups } from '../constants/blood-groups';

type DonorProfilePayload = {
  bloodGroup?: string;
  donationHistory?: Array<{ donatedAt: string }>;
  availabilityStatus?: boolean;
};

type NotificationPayload = {
  createdAt: string;
  title: string;
};

const bloodGroupLabel = Object.fromEntries(bloodGroups.map((item) => [item.value, item.label]));

export default function DonorDashboardPage() {
  const [loading, setLoading] = useState(true);
  const [bloodGroup, setBloodGroup] = useState('Not set');
  const [donationCount, setDonationCount] = useState(0);
  const [availability, setAvailability] = useState('Not set');
  const [alerts, setAlerts] = useState<string[]>([]);
  const [recentActivity, setRecentActivity] = useState<string[]>([]);

  useEffect(() => {
    const loadDashboard = async () => {
      try {
        const [profileRes, notificationsRes] = await Promise.allSettled([api.get('/donors/profile'), api.get('/notifications')]);

        if (profileRes.status === 'fulfilled') {
          const profile = (profileRes.value.data?.data ?? {}) as DonorProfilePayload;
          if (profile.bloodGroup) {
            setBloodGroup(bloodGroupLabel[profile.bloodGroup] ?? profile.bloodGroup);
          }
          setDonationCount(profile.donationHistory?.length ?? 0);
          if (typeof profile.availabilityStatus === 'boolean') {
            setAvailability(profile.availabilityStatus ? 'Available' : 'Not Available');
          }
          const donationEvents = (profile.donationHistory ?? [])
            .slice(-3)
            .reverse()
            .map((entry) => `Donation completed on ${new Date(entry.donatedAt).toLocaleDateString()}`);
          setRecentActivity(donationEvents);
        }

        if (notificationsRes.status === 'fulfilled') {
          const notifications = (notificationsRes.value.data?.data ?? []) as NotificationPayload[];
          const topAlerts = notifications.slice(0, 3).map((item) => item.title);
          setAlerts(topAlerts);
          if (topAlerts.length > 0) {
            setRecentActivity((prev) => [...topAlerts.map((item) => `Alert received: ${item}`), ...prev].slice(0, 5));
          }
        }
      } finally {
        setLoading(false);
      }
    };

    void loadDashboard();
  }, []);

  return (
    <section className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Dashboard</h1>
        <p className="text-sm text-gray-600">Overview updates automatically as you donate, respond to requests, and receive alerts.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Blood Group</p>
          <p className="text-2xl font-bold text-primary">{loading ? 'Loading...' : bloodGroup}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Availability</p>
          <p className="text-2xl font-bold text-primary">{loading ? 'Loading...' : availability}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Total Donations</p>
          <p className="text-2xl font-bold text-primary">{loading ? '...' : donationCount}</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Open Alerts</p>
          <p className="text-2xl font-bold text-primary">{loading ? '...' : alerts.length}</p>
        </div>
      </div>

      <div className="grid gap-3 lg:grid-cols-2">
        <article className="card space-y-2">
          <h2 className="text-lg font-bold text-primary">Recent Activity</h2>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-gray-600">No activity yet.</p>
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
