import { FormEvent, useState } from 'react';
import api from '../services/api';

const emptyForm = {
  weightKg: '',
  hadFeverRecently: '',
  currentlyOnMedication: '',
  chronicCondition: '',
  recentTravel: '',
};

export default function HealthEligibilityFormPage() {
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState(emptyForm);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError('');
    setSaving(true);
    try {
      await api.post('/donors/health-form', {
        weightKg: Number(form.weightKg),
        hadFeverRecently: form.hadFeverRecently,
        currentlyOnMedication: form.currentlyOnMedication,
        recentTravel: form.recentTravel,
        chronicCondition: form.chronicCondition || undefined,
      });
      setSaved(true);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not submit health form.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Health & Eligibility Form</h1>
      <p className="text-sm text-gray-600">Fill or update medical info before donation.</p>
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Health form saved.</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit} autoComplete="off">
        <label className="text-sm font-semibold">
          Weight (kg)
          <input className="legacy-input mt-1" value={form.weightKg} onChange={(e) => setForm((v) => ({ ...v, weightKg: e.target.value.replace(/[^\d.]/g, '') }))} required />
        </label>
        <label className="text-sm font-semibold">
          Fever in last 14 days?
          <select className="legacy-input mt-1" value={form.hadFeverRecently} onChange={(e) => setForm((v) => ({ ...v, hadFeverRecently: e.target.value }))} required>
            <option value="">Select</option>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Currently on medication?
          <select className="legacy-input mt-1" value={form.currentlyOnMedication} onChange={(e) => setForm((v) => ({ ...v, currentlyOnMedication: e.target.value }))} required>
            <option value="">Select</option>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Recent travel in last 30 days?
          <select className="legacy-input mt-1" value={form.recentTravel} onChange={(e) => setForm((v) => ({ ...v, recentTravel: e.target.value }))} required>
            <option value="">Select</option>
            <option value="No">No</option>
            <option value="Yes">Yes</option>
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Chronic Condition (if any)
          <textarea className="legacy-input mt-1" rows={3} value={form.chronicCondition} onChange={(e) => setForm((v) => ({ ...v, chronicCondition: e.target.value }))} />
        </label>
        <button className="btn-primary sm:col-span-2 disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={saving}>
          {saving ? 'Submitting...' : 'Save Health Form'}
        </button>
      </form>
    </section>
  );
}
