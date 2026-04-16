export default function AdminManagementPage() {
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-bold text-primary">Admin Management</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Manage Donors</h2>
          <p className="text-sm text-muted">Verify donor records and eligibility.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Manage Hospitals</h2>
          <p className="text-sm text-muted">Review hospital profiles and request activity.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">User Management</h2>
          <p className="text-sm text-muted">Activate/deactivate users and update roles.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Audit Logs</h2>
          <p className="text-sm text-muted">Track sensitive actions and compliance events.</p>
        </div>
      </div>
    </section>
  );
}
