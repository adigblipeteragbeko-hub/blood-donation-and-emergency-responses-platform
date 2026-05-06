import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getHospitalReportsSummary } from '../services/hospital-portal';
import { FilterBox } from '../components/TableControls';

type SummaryData = {
  donationActivity?: { totalDonations: number };
  requestFulfillment?: { totalRequests: number };
  emergencyResponse?: { totalEmergencyRequests: number };
  predictiveAnalytics?: { projected7DayDemand?: number; shortageRisk?: Array<{ riskLevel: string }> };
};

export default function HospitalReportsPage() {
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<SummaryData>({});
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const load = async (fromDate?: string, toDate?: string) => {
    setLoading(true);
    try {
      const data = await getHospitalReportsSummary(fromDate, toDate);
      setSummary(data as SummaryData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await load(from || undefined, to || undefined);
  };

  const highRiskCount = summary.predictiveAnalytics?.shortageRisk?.filter((item) => item.riskLevel === 'HIGH' || item.riskLevel === 'CRITICAL').length ?? 0;
  const filteredRiskRows = useMemo(
    () =>
      (summary.predictiveAnalytics?.shortageRisk ?? []).filter((item) => {
        if (!searchTerm) {
          return true;
        }
        return JSON.stringify(item).toLowerCase().includes(searchTerm);
      }),
    [summary.predictiveAnalytics?.shortageRisk, searchTerm],
  );
  useEffect(() => {
    setPage(0);
  }, [searchTerm, summary.predictiveAnalytics?.shortageRisk]);
  const totalPages = Math.max(1, Math.ceil(filteredRiskRows.length / pageSize));
  const pagedRiskRows = filteredRiskRows.slice(page * pageSize, page * pageSize + pageSize);

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Reports &amp; Analytics</h1>
        <p className="text-sm text-muted">Blood usage, trends, shortages, and fulfillment performance.</p>
      </div>

      <form className="card flex flex-wrap items-end gap-3" onSubmit={submit}>
        <label className="text-sm font-semibold">
          From
          <input className="legacy-input mt-1" type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          To
          <input className="legacy-input mt-1" type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn-primary" disabled={loading} type="submit">
          {loading ? 'Loading...' : 'Run Report'}
        </button>
      </form>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="card">
          <p className="text-sm font-semibold text-muted">Total Donations</p>
          <p className="mt-2 text-2xl font-bold text-primary">{loading ? '...' : summary.donationActivity?.totalDonations ?? 0}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Total Requests</p>
          <p className="mt-2 text-2xl font-bold text-primary">{loading ? '...' : summary.requestFulfillment?.totalRequests ?? 0}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Emergency Requests</p>
          <p className="mt-2 text-2xl font-bold text-primary">{loading ? '...' : summary.emergencyResponse?.totalEmergencyRequests ?? 0}</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Shortage Risk (High/Critical)</p>
          <p className="mt-2 text-2xl font-bold text-primary">{loading ? '...' : highRiskCount}</p>
        </article>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-bold text-primary">Shortage Risk Rows</h2>
        <FilterBox
          label="Filter risk rows (debounced)"
          placeholder="Filter predictive risk entries..."
          value={searchInput}
          onChange={setSearchInput}
          withCard={false}
        />
        {pagedRiskRows.length === 0 ? (
          <p className="text-sm text-muted">No shortage risk rows for this period.</p>
        ) : (
          <div className="space-y-2">
            {pagedRiskRows.map((row, index) => (
              <div className="rounded border p-2 text-sm" key={`${row.riskLevel}-${index}`}>
                <pre className="whitespace-pre-wrap break-words text-xs">{JSON.stringify(row, null, 2)}</pre>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-center gap-2">
          <button
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            type="button"
            disabled={page === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            Previous
          </button>
          <span className="text-sm text-muted">
            Page {Math.min(page + 1, totalPages)} of {totalPages}
          </span>
          <button
            className="rounded border px-3 py-1 text-sm disabled:opacity-50"
            type="button"
            disabled={page + 1 >= totalPages}
            onClick={() => setPage((value) => value + 1)}
          >
            Next
          </button>
        </div>
      </div>
    </section>
  );
}
