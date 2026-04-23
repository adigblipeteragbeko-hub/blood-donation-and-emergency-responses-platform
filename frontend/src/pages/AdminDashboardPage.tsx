import { Link } from 'react-router-dom';

const adminSections = [
  'Manage Donors',
  'Manage Hospitals',
  'Manage Requests',
  'Manage Inventory',
  'Reports and Analytics',
  'Audit Logs',
  'Settings',
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
          <article key={section} className="card">
            <p className="text-sm font-semibold">{section}</p>
          </article>
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
