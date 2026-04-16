export default function ReportsPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold text-primary">Reports and Analytics</h1>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="card">
          <h2 className="font-semibold">Blood Stock Report</h2>
          <p className="text-sm text-muted">Current stock per blood group and trend indicators.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Donation Activity</h2>
          <p className="text-sm text-muted">Donor participation and completed donation counts.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Request Fulfillment</h2>
          <p className="text-sm text-muted">Open vs fulfilled requests and cycle time.</p>
        </div>
        <div className="card">
          <h2 className="font-semibold">Emergency Response</h2>
          <p className="text-sm text-muted">Critical request response speed and outcomes.</p>
        </div>
      </div>
    </section>
  );
}
