import { useEffect, useState } from 'react';
import api from '../services/api';

type DonationItem = {
  id: string;
  donatedAt: string;
  location: string;
  unitsDonated: number;
  screeningResult?: string | null;
};

export default function HistoryPage() {
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/donors/profile');
        const profile = response.data?.data;
        setDonations((profile?.donationHistory ?? []) as DonationItem[]);
      } catch {
        setError('Could not load donation history.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Donation History</h1>
      <p className="text-sm text-gray-600">List of past donations with dates, locations, and status.</p>
      {loading ? <p className="rounded border border-gray-200 p-3 text-sm text-gray-600">Loading...</p> : null}
      {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && donations.length === 0 ? (
        <p className="rounded border border-gray-200 p-3 text-sm text-gray-600">No donations recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-red-200 text-primary">
                <th className="py-2">Date</th>
                <th className="py-2">Location</th>
                <th className="py-2">Units</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2">{new Date(item.donatedAt).toLocaleDateString()}</td>
                  <td className="py-2">{item.location}</td>
                  <td className="py-2">{item.unitsDonated}</td>
                  <td className="py-2">{item.screeningResult ?? 'Completed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
