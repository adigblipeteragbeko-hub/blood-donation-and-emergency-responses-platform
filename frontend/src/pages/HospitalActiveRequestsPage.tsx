export default function HospitalActiveRequestsPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Active Requests</h1>
        <p className="text-sm text-muted">Track ongoing requests, donor responses, and fulfillment progress.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-primary">Ongoing Request Queue</h2>
        <p className="mt-2 text-sm text-muted">
          No active requests yet. Requests created from the Request Blood tab will appear here with status updates.
        </p>
      </div>
    </section>
  );
}

