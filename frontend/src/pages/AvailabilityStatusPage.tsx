import { useEffect, useState } from 'react';
import api from '../services/api';

export default function AvailabilityStatusPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [healthFormCompleted, setHealthFormCompleted] = useState(false);
  const [adminApproved, setAdminApproved] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/donors/eligibility/status');
      const data = response.data?.data ?? response.data;
      setAvailable(Boolean(data?.availabilityStatus));
      setHealthFormCompleted(Boolean(data?.healthFormCompleted));
      setAdminApproved(Boolean(data?.adminApproved));
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not load availability status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadStatus();
  }, []);

  const updateAvailability = async (nextAvailable: boolean) => {
    setSaving(true);
    setError('');
    try {
      const response = await api.patch('/donors/availability', { available: nextAvailable });
      const updated = response.data?.data ?? response.data;
      setAvailable(Boolean(updated?.availabilityStatus));
      await loadStatus();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not update availability.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Availability Status</h1>
      <p className="text-sm text-gray-600">Toggle your donation availability so hospitals can contact you correctly.</p>
      {loading ? <p className="text-sm text-muted">Loading status...</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <div className="rounded border border-gray-200 p-4">
        <p className="text-sm text-gray-600">Current status</p>
        <p className="text-xl font-bold text-primary">
          {available === null ? 'Not set' : available ? 'Available for Donation' : 'Not Available'}
        </p>
        <p className="mt-2 text-sm text-gray-600">Eligibility form: {healthFormCompleted ? 'Completed' : 'Not completed'}</p>
        <p className="text-sm text-gray-600">Admin approval: {adminApproved ? 'Approved' : 'Pending approval'}</p>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void updateAvailability(true)} type="button" disabled={saving || !healthFormCompleted || !adminApproved}>
          Set Available
        </button>
        <button className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void updateAvailability(false)} type="button" disabled={saving}>
          Set Not Available
        </button>
      </div>
      {!healthFormCompleted ? <p className="text-sm text-amber-700">Complete Health & Eligibility Form first.</p> : null}
      {healthFormCompleted && !adminApproved ? <p className="text-sm text-amber-700">Your form is submitted. Wait for admin approval before setting available.</p> : null}
    </section>
  );
}
