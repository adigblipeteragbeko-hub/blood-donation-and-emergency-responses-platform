import { FormEvent, useEffect, useState } from 'react';
import api from '../services/api';

type ProfileVisibility = 'PRIVATE' | 'PUBLIC';

const emptySettings = {
  currentPassword: '',
  newPassword: '',
  emailNotifications: false,
  smsNotifications: false,
  profileVisibility: 'PRIVATE' as ProfileVisibility,
};

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptySettings);

  useEffect(() => {
    const loadSettings = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/donors/profile');
        const profile = response.data?.data ?? response.data ?? {};
        setForm((value) => ({
          ...value,
          emailNotifications: Boolean(profile.notificationEmailEnabled),
          smsNotifications: Boolean(profile.notificationSmsEnabled),
          profileVisibility: profile.profileVisibility === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE',
        }));
      } catch {
        setError('Unable to load settings. Private privacy mode is being used by default.');
        setForm((value) => ({ ...value, profileVisibility: 'PRIVATE' }));
      } finally {
        setLoading(false);
      }
    };

    void loadSettings();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      await api.patch('/donors/settings', {
        notificationEmailEnabled: form.emailNotifications,
        notificationSmsEnabled: form.smsNotifications,
        profileVisibility: form.profileVisibility || 'PRIVATE',
      });
      setForm((value) => ({ ...value, profileVisibility: value.profileVisibility || 'PRIVATE' }));
      setSaved(true);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Unable to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Settings</h1>
      <p className="text-sm text-gray-600">Change password, notification preferences, and privacy settings.</p>
      {loading ? <p className="rounded bg-gray-50 p-2 text-sm text-gray-600">Loading settings...</p> : null}
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Settings saved.</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
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
          <select
            className="legacy-input mt-1"
            value={form.profileVisibility || 'PRIVATE'}
            onChange={(e) => setForm((v) => ({ ...v, profileVisibility: e.target.value === 'PUBLIC' ? 'PUBLIC' : 'PRIVATE' }))}
            required
          >
            <option value="PRIVATE">Private</option>
            <option value="PUBLIC">Public</option>
          </select>
          <span className="mt-1 block text-xs font-normal text-gray-600">
            Private is recommended. Your personal details are only visible to authorized hospital staff and administrators.
          </span>
        </label>

        <button className="btn-primary" type="submit" disabled={saving || loading}>
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </form>
    </section>
  );
}
