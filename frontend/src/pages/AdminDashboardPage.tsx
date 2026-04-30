import { Link } from 'react-router-dom';

const adminSections = [
  { label: 'Manage Donors', to: '/admin/management?section=donors' },
  { label: 'Manage Hospitals', to: '/admin/management?section=hospitals' },
  { label: 'Manage Requests', to: '/admin/management?section=request-tracking' },
  { label: 'Manage Inventory', to: '/admin/management?section=inventory-tracking' },
  { label: 'Reports and Analytics', to: '/reports' },
  { label: 'Audit Logs', to: '/admin/management?section=audit' },
  { label: 'Settings', to: '/admin/management?section=settings' },
];

export default function AdminDashboardPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Admin Dashboard</h1>
        <p className="text-sm text-muted">Hospital-grade supervision for requests, users, inventory, and platform activity.</p>
      </div>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {adminSections.map((section) => (
          <Link key={section.label} to={section.to} className="card block transition hover:border-red-300 hover:shadow-sm">
            <p className="text-sm font-semibold">{section.label}</p>
          </Link>
        ))}
      </div>
      <div className="card">
        <Link className="btn-primary inline-flex" to="/admin/management">
          Open Management Console
        </Link>
      </div>
    </section>
  );
}
