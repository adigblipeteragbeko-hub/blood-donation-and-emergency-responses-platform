import { useAuth } from '../hooks/useAuth';

export default function DashboardPage() {
  const { user } = useAuth();

  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Role Dashboard</h1>
      <div className="card">
        <p className="text-lg">
          Logged in as <span className="font-semibold">{user?.role}</span>
        </p>
        <p className="text-sm text-muted">Use the navigation tabs to manage requests, appointments, and reports.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="card">
          <h2 className="font-semibold">Admin</h2>
          <p className="text-sm text-muted">User management, audit logs, and analytics.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Donor</h2>
          <p className="text-sm text-muted">Availability, donation history, and emergency alerts.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Hospital Staff</h2>
          <p className="text-sm text-muted">Inventory, blood requests, and donor matching.</p>
        </div>
      </div>
    </section>
  );
}
