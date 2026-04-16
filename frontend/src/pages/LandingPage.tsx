export default function LandingPage() {
  return (
    <section className="space-y-4">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold text-primary">Hospital Blood Donation and Emergency Response</h1>
        <p className="text-lg text-muted">
          A secure and real-time coordination platform for donors, hospitals, and administrators.
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="card">
            <h3 className="font-semibold">Urgent Matching</h3>
            <p className="text-sm text-muted">Automatically match donors by blood group and location.</p>
          </div>
          <div className="card">
            <h3 className="font-semibold">Hospital Inventory</h3>
            <p className="text-sm text-muted">Track blood units and prevent critical shortages.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
