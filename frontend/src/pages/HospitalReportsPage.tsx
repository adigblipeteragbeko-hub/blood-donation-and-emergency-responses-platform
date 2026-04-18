import { FormEvent, useEffect, useState } from 'react';
import { getHospitalReportsSummary } from '../services/hospital-portal';

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

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    await load(from || undefined, to || undefined);
  };

  const highRiskCount = summary.predictiveAnalytics?.shortageRisk?.filter((item) => item.riskLevel === 'HIGH' || item.riskLevel === 'CRITICAL').length ?? 0;

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
    </section>
  );
}

