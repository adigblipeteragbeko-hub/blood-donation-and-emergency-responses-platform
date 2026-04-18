export default function HospitalReportsPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Reports &amp; Analytics</h1>
        <p className="text-sm text-muted">Analyze blood usage, trends, shortages, and request performance.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <article className="card">
          <p className="text-sm font-semibold text-muted">Usage This Month</p>
          <p className="mt-2 text-2xl font-bold text-primary">0 Units</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Fulfilled Requests</p>
          <p className="mt-2 text-2xl font-bold text-primary">0</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Shortage Alerts</p>
          <p className="mt-2 text-2xl font-bold text-primary">0</p>
        </article>
        <article className="card">
          <p className="text-sm font-semibold text-muted">Response Time</p>
          <p className="mt-2 text-2xl font-bold text-primary">--</p>
        </article>
      </div>
    </section>
  );
}

