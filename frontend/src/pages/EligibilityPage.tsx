import { useEffect, useState } from 'react';
import api from '../services/api';

type EligibilityStatus = {
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
};

export default function EligibilityPage() {
  const [status, setStatus] = useState<EligibilityStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const formatStatus = (value?: string | null) => value ? value.replace(/_/g, ' ') : 'Not started';
  const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString() : 'Not recorded';

  useEffect(() => {
    const loadStatus = async () => {
      setLoading(true);
      setError('');
      try {
        const response = await api.get('/donors/eligibility/status');
        setStatus(response.data?.data ?? response.data);
      } catch (err: any) {
        const apiError = err?.response?.data?.error;
        const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
        setError(extracted ?? 'Unable to load eligibility status.');
      } finally {
        setLoading(false);
      }
    };
    void loadStatus();
  }, []);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Eligibility Status</h1>
      <p className="text-sm text-gray-600">Shows if donor can donate now or next available date.</p>
      {loading ? <p className="text-sm text-muted">Loading eligibility status...</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
        Status: <span className="font-semibold">{status?.canSetAvailable ? 'Eligible for availability' : 'Not eligible for availability yet'}</span>
        {status?.reason ? <p className="mt-1 text-gray-600">{status.reason}</p> : null}
      </div>
      {status?.blockedByRecentDonation ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          Donation cooldown active. You can become available again after the next eligibility date.
        </div>
      ) : null}
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
        Review status: <span className="font-semibold">{formatStatus(status?.reviewStatus)}</span>
      </div>
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
        Blood Group: <span className="font-semibold">{status?.bloodGroupConfirmed ? status?.bloodGroup : 'Pending hospital confirmation'}</span>
      </div>
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
        Last donation date: <span className="font-semibold">{formatDate(status?.lastDonationDate)}</span>
      </div>
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
        Next eligibility date: <span className="font-semibold">{formatDate(status?.nextEligibilityDate)}</span>
      </div>
    </section>
  );
}
