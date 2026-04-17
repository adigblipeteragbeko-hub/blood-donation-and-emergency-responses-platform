import { FormEvent, useState } from 'react';

const emptySettings = {
  currentPassword: '',
  newPassword: '',
  emailNotifications: false,
  smsNotifications: false,
  profileVisibility: '',
};

export default function SettingsPage() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(emptySettings);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Settings</h1>
      <p className="text-sm text-gray-600">Change password, notification preferences, and privacy settings.</p>
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Settings saved.</p> : null}
      <form className="space-y-3" onSubmit={submit} autoComplete="off">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Current Password
            <input className="legacy-input mt-1" type="password" value={form.currentPassword} onChange={(e) => setForm((v) => ({ ...v, currentPassword: e.target.value }))} />
          </label>
          <label className="text-sm font-semibold">
            New Password
            <input className="legacy-input mt-1" type="password" value={form.newPassword} onChange={(e) => setForm((v) => ({ ...v, newPassword: e.target.value }))} />
          </label>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input checked={form.emailNotifications} onChange={(e) => setForm((v) => ({ ...v, emailNotifications: e.target.checked }))} type="checkbox" />
          Email Notifications
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input checked={form.smsNotifications} onChange={(e) => setForm((v) => ({ ...v, smsNotifications: e.target.checked }))} type="checkbox" />
          SMS Notifications
        </label>

        <label className="text-sm font-semibold">
          Privacy
          <select className="legacy-input mt-1" value={form.profileVisibility} onChange={(e) => setForm((v) => ({ ...v, profileVisibility: e.target.value }))} required>
            <option value="">Select</option>
            <option value="Private">Private</option>
            <option value="Public">Public</option>
          </select>
        </label>

        <button className="btn-primary" type="submit">
          Save Settings
        </button>
      </form>
    </section>
  );
}
