import { useEffect, useState } from 'react';
import api from '../services/api';

type AvailabilityStatus = {
  availabilityStatus?: boolean;
  healthFormCompleted?: boolean;
  healthFormSubmitted?: boolean;
  adminApproved?: boolean;
  canSetAvailable?: boolean;
  reason?: string;
  reviewStatus?: string | null;
  officeUseCompleted?: boolean;
  bloodGroupConfirmed?: boolean;
  bloodGroup?: string;
  lastDonationDate?: string | null;
  nextEligibilityDate?: string | null;
  blockedByRecentDonation?: boolean;
  accountActive?: boolean;
  emailVerified?: boolean;
};

export default function AvailabilityStatusPage() {
  const [available, setAvailable] = useState<boolean | null>(null);
  const [status, setStatus] = useState<AvailabilityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const formatStatus = (value?: string | null) => value ? value.replace(/_/g, ' ') : 'Not started';
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not recorded';

  const loadStatus = async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/donors/eligibility/status');
      const data = response.data?.data ?? response.data;
      setAvailable(Boolean(data?.availabilityStatus));
      setStatus(data ?? null);
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
          {available === null
            ? 'Not set'
            : status?.blockedByRecentDonation
              ? 'Cooldown Active'
              : available
                ? 'Available for Donation'
                : 'Not Available'}
        </p>
        <div className="mt-3 grid gap-2 text-sm text-gray-600 sm:grid-cols-2">
          <p>Eligibility form: {status?.healthFormCompleted ? 'Approved' : status?.healthFormSubmitted ? 'Submitted' : 'Not completed'}</p>
          <p>Clinical status: {formatStatus(status?.reviewStatus)}</p>
          <p>Office use: {status?.officeUseCompleted ? 'Completed' : 'Pending'}</p>
          <p>Blood group: {status?.bloodGroupConfirmed ? status?.bloodGroup : 'Pending confirmation'}</p>
          <p>Final approval: {status?.adminApproved ? 'Approved' : 'Pending approval'}</p>
          <p>Email verification: {status?.emailVerified ? 'Verified' : 'Required'}</p>
          <p>Last donation: {formatDate(status?.lastDonationDate)}</p>
          <p>Next eligibility: {formatDate(status?.nextEligibilityDate)}</p>
        </div>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void updateAvailability(true)} type="button" disabled={saving || !status?.canSetAvailable}>
          Set Available
        </button>
        <button className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60" onClick={() => void updateAvailability(false)} type="button" disabled={saving}>
          Set Not Available
        </button>
      </div>
      {status?.reason ? (
        <p className={`text-sm ${status.canSetAvailable ? 'text-green-700' : 'text-amber-700'}`}>{status.reason}</p>
      ) : null}
      {status?.blockedByRecentDonation ? (
        <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          You recently completed a donation. Availability is locked until the next eligibility date.
        </p>
      ) : null}
    </section>
  );
}
