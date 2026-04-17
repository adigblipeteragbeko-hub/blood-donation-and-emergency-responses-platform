export default function SettingsPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Settings</h1>
      <p className="text-sm text-gray-600">Manage notification preferences, password, and account options.</p>
      <div className="grid gap-2 sm:grid-cols-2">
        <button className="btn-primary">Update Preferences</button>
        <button className="rounded-lg border border-primary px-4 py-2 font-semibold text-primary">Change Password</button>
      </div>
    </section>
  );
}
