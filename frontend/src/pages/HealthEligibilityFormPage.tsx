import { FormEvent, useState } from 'react';

const emptyForm = {
  weightKg: '',
  hadFeverRecently: '',
  currentlyOnMedication: '',
  chronicCondition: '',
  recentTravel: '',
};

export default function HealthEligibilityFormPage() {
  const [saved, setSaved] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Health & Eligibility Form</h1>
      <p className="text-sm text-gray-600">Fill or update medical info before donation.</p>
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Health form saved.</p> : null}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit} autoComplete="off">
        <label className="text-sm font-semibold">
          Weight (kg)
          <input className="legacy-input mt-1" value={form.weightKg} onChange={(e) => setForm((v) => ({ ...v, weightKg: e.target.value }))} required />
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
        <button className="btn-primary sm:col-span-2" type="submit">
          Save Health Form
        </button>
      </form>
    </section>
  );
}
