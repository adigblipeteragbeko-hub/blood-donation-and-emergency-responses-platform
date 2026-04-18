export default function HospitalSettingsPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <p className="text-sm text-muted">Manage security, permissions, and notification preferences.</p>
      </div>

      <div className="card space-y-3">
        <label className="flex items-center justify-between rounded border border-red-100 px-3 py-2">
          <span className="text-sm font-semibold">Enable emergency SMS notifications</span>
          <input type="checkbox" />
        </label>
        <label className="flex items-center justify-between rounded border border-red-100 px-3 py-2">
          <span className="text-sm font-semibold">Enable donor response email alerts</span>
          <input type="checkbox" />
        </label>
        <label className="flex items-center justify-between rounded border border-red-100 px-3 py-2">
          <span className="text-sm font-semibold">Require two-step verification for staff logins</span>
          <input type="checkbox" />
        </label>
      </div>
    </section>
  );
}

