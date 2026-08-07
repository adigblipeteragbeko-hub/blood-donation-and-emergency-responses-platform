import { useTheme } from '../hooks/useTheme';
import { ThemePreference } from '../utils/theme';

export default function HospitalSettingsPage() {
  const { preference, setPreference } = useTheme();

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Settings</h1>
        <p className="text-sm text-muted">Manage security, permissions, and notification preferences.</p>
      </div>

      <div className="card space-y-3">
        <div className="rounded-2xl border border-slate-100 p-4">
          <h2 className="text-lg font-bold text-primary">Appearance</h2>
          <p className="mt-1 text-sm text-muted">Choose the hospital portal appearance on this device.</p>
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
