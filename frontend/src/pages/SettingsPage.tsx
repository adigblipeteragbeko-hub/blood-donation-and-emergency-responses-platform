import { FormEvent, useEffect, useState } from 'react';
import api from '../services/api';
import { useTheme } from '../hooks/useTheme';
import { ThemePreference } from '../utils/theme';

type ProfileVisibility = 'PRIVATE' | 'PUBLIC';

const emptySettings = {
  currentPassword: '',
  newPassword: '',
  emailNotifications: false,
  smsNotifications: false,
  profileVisibility: 'PRIVATE' as ProfileVisibility,
};

export default function SettingsPage() {
  const { preference, setPreference } = useTheme();
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
        <div className="rounded-2xl border border-slate-100 p-4">
          <h2 className="text-lg font-bold text-primary">Appearance</h2>
          <p className="mt-1 text-sm text-muted">Choose how the platform looks on this device.</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Appearance">
            {[
              { value: 'light', label: 'Light', description: 'Use the light platform appearance.' },
              { value: 'dark', label: 'Dark', description: 'Use a darker appearance designed for low-light environments.' },
              { value: 'system', label: 'System', description: 'Automatically match your device appearance.' },
            ].map((item) => (
              <button
                key={item.value}
                type="button"
                role="radio"
                aria-checked={preference === item.value}
                className={`${preference === item.value ? 'border-primary bg-red-50 text-primary' : 'border-slate-200 bg-white text-slate-700'} rounded-2xl border p-3 text-left transition hover:border-red-200`}
                onClick={() => setPreference(item.value as ThemePreference)}
              >
                <span className="block font-black">{item.label}</span>
                <span className="mt-1 block text-xs text-muted">{item.description}</span>
              </button>
            ))}
          </div>
        </div>

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
