import { useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import { FilterBox, Pager } from '../components/TableControls';

type DonationItem = {
  id: string;
  donationNumber?: string | null;
  donatedAt: string;
  location: string;
  unitsDonated: number;
  bloodGroup?: string | null;
  screeningResult?: string | null;
  notes?: string | null;
  hospital?: { hospitalName?: string | null; location?: string | null } | null;
};

export default function HistoryPage() {
  const [donations, setDonations] = useState<DonationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 25;
  const nextEligibilityDate = (value: string) => {
    const date = new Date(value);
    date.setMonth(date.getMonth() + 2);
    return date.toLocaleDateString();
  };
  const detailFromNotes = (notes: string | null | undefined, label: string) => {
    const match = notes?.match(new RegExp(`${label}:\\s*([^|]+)`, 'i'));
    return match?.[1]?.trim() ?? '';
  };

  useEffect(() => {
    const load = async () => {
      try {
        const response = await api.get('/donors/profile');
        const profile = response.data?.data ?? response.data ?? {};
        setDonations((profile?.donationHistory ?? []) as DonationItem[]);
      } catch {
        setError('Could not load donation history.');
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    setPage(0);
  }, [searchTerm]);

  const filteredDonations = useMemo(
    () =>
      donations.filter(
        (item) =>
          !searchTerm ||
          item.location.toLowerCase().includes(searchTerm) ||
          String(item.unitsDonated).includes(searchTerm) ||
          (item.donationNumber ?? '').toLowerCase().includes(searchTerm) ||
          (item.screeningResult ?? 'completed').toLowerCase().includes(searchTerm),
      ),
    [donations, searchTerm],
  );

  const totalPages = Math.max(1, Math.ceil(filteredDonations.length / pageSize));
  const visibleDonations = filteredDonations.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Donation History</h1>
      <p className="text-sm text-gray-600">List of past donations with dates, locations, and status.</p>
      <FilterBox
        label="Filter donation history (debounced)"
        placeholder="Filter by location, units, or status..."
        value={searchInput}
        onChange={setSearchInput}
        withCard={false}
      />
      {loading ? <p className="rounded border border-gray-200 p-3 text-sm text-gray-600">Loading...</p> : null}
      {error ? <p className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p> : null}
      {!loading && filteredDonations.length === 0 ? (
        <p className="rounded border border-gray-200 p-3 text-sm text-gray-600">No donations recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-red-200 text-primary">
                <th className="py-2">Date</th>
                <th className="py-2">Donation Number</th>
                <th className="py-2">Appointment</th>
                <th className="py-2">Hospital / Location</th>
                <th className="py-2">Blood Group</th>
                <th className="py-2">Units</th>
                <th className="py-2">Volume</th>
                <th className="py-2">Next Eligible</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {visibleDonations.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2">{new Date(item.donatedAt).toLocaleString()}</td>
                  <td className="py-2">{item.donationNumber ?? 'Not assigned'}</td>
                  <td className="py-2">{detailFromNotes(item.notes, 'Appointment') || 'Not linked'}</td>
                  <td className="py-2">{item.hospital?.hospitalName ?? item.location}</td>
                  <td className="py-2">{item.bloodGroup ?? 'Not recorded'}</td>
                  <td className="py-2">{item.unitsDonated}</td>
                  <td className="py-2">{detailFromNotes(item.notes, 'Volume') || 'Not recorded'}</td>
                  <td className="py-2">{nextEligibilityDate(item.donatedAt)}</td>
                  <td className="py-2">{item.screeningResult ?? 'Completed'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div>
        <Pager
          page={Math.min(page, Math.max(0, totalPages - 1))}
          hasMore={page + 1 < totalPages}
          onPrev={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => setPage((value) => value + 1)}
        />
      </div>
    </section>
  );
}
