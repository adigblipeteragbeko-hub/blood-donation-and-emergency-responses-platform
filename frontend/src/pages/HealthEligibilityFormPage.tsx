import { FormEvent, useState } from 'react';

export default function HealthEligibilityFormPage() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState({
    weightKg: '',
    hadFeverRecently: 'No',
    currentlyOnMedication: 'No',
    chronicCondition: '',
    recentTravel: 'No',
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Health & Eligibility Form</h1>
      <p className="text-sm text-gray-600">Fill or update medical info before donation.</p>
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Health form updated successfully.</p> : null}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Weight (kg)
          <input className="legacy-input mt-1" value={form.weightKg} onChange={(e) => setForm((v) => ({ ...v, weightKg: e.target.value }))} required />
        </label>
        <label className="text-sm font-semibold">
          Fever in last 14 days?
          <select className="legacy-input mt-1" value={form.hadFeverRecently} onChange={(e) => setForm((v) => ({ ...v, hadFeverRecently: e.target.value }))}>
            <option>No</option>
            <option>Yes</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Currently on medication?
          <select className="legacy-input mt-1" value={form.currentlyOnMedication} onChange={(e) => setForm((v) => ({ ...v, currentlyOnMedication: e.target.value }))}>
            <option>No</option>
            <option>Yes</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Recent travel in last 30 days?
          <select className="legacy-input mt-1" value={form.recentTravel} onChange={(e) => setForm((v) => ({ ...v, recentTravel: e.target.value }))}>
            <option>No</option>
            <option>Yes</option>
          </select>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Chronic Condition (if any)
          <textarea className="legacy-input mt-1" rows={3} value={form.chronicCondition} onChange={(e) => setForm((v) => ({ ...v, chronicCondition: e.target.value }))} />
        </label>
        <button className="btn-primary sm:col-span-2" type="submit">
          Save Health Form
        </button>
      </form>
    </section>
  );
}
