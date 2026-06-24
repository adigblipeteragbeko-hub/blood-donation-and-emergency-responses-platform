import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';

type DonationItem = {
  id: string;
  donatedAt: string;
  location?: string | null;
  unitsDonated?: number | null;
  bloodGroup?: string | null;
  notes?: string | null;
  hospital?: { hospitalName?: string | null; location?: string | null } | null;
};

type DonorProfilePayload = {
  donationHistory?: DonationItem[];
  nextEligibilityDate?: string | null;
};

const detailFromNotes = (notes: string | null | undefined, label: string) => {
  const match = notes?.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'));
  return match?.[1]?.trim() ?? '';
};

export default function RewardsPage() {
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const loadRewards = async () => {
      try {
        const response = await api.get('/donors/profile');
        const profile = (response.data?.data ?? response.data ?? {}) as DonorProfilePayload;
        setDonations(profile.donationHistory ?? []);
      } catch {
        setError('Unable to load donation rewards right now.');
      } finally {
        setLoading(false);
      }
    };

    void loadRewards();
  }, []);

  const donationCount = donations.length;
  const latestDonation = donations[0];
  const badges = useMemo(() => {
    const earned: string[] = [];
    if (donationCount >= 1) earned.push('First Donation');
    if (donationCount >= 5) earned.push('Five Donation Milestone');
    if (donationCount >= 10) earned.push('Ten Donation Milestone');
    if (donationCount >= 25) earned.push('Twenty-Five Donation Champion');
    return earned;
  }, [donationCount]);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Rewards / Achievements</h1>
      <p className="text-sm text-gray-600">Track badges, donation count, and recognition for your impact.</p>
      <div className="rounded border border-gray-200 p-4">
        <p className="text-sm text-gray-600">Total Donations</p>
        <p className="text-2xl font-bold text-primary">{loading ? '...' : donationCount}</p>
      </div>
      {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {latestDonation ? (
        <div className="rounded border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <p className="font-bold">Latest donation recorded</p>
          <p>
            {new Date(latestDonation.donatedAt).toLocaleString()} at{' '}
            {latestDonation.hospital?.hospitalName ?? latestDonation.location ?? 'the hospital'}
          </p>
          <p>
            {latestDonation.unitsDonated ?? 1} unit
            {(latestDonation.unitsDonated ?? 1) === 1 ? '' : 's'} donated
            {latestDonation.bloodGroup ? ` (${latestDonation.bloodGroup})` : ''}.
          </p>
          {detailFromNotes(latestDonation.notes, 'Appointment') ? (
            <p>Appointment: {detailFromNotes(latestDonation.notes, 'Appointment')}</p>
          ) : null}
        </div>
      ) : null}
      {badges.length === 0 ? (
        <p className="rounded border border-gray-200 p-3 text-sm text-gray-600">
          {loading ? 'Loading achievements...' : 'No badges yet. Complete a donation to unlock achievements.'}
        </p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {badges.map((badge) => (
            <div key={badge} className="rounded border border-red-200 bg-red-50 p-3 text-sm font-semibold text-primary">
              {badge}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
