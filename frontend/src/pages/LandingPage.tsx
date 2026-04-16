export default function LandingPage() {
  return (
    <section className="grid gap-6 md:grid-cols-2">
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
      <div className="card border-red-200 bg-red-50">
        <h2 className="text-2xl font-bold text-primary">Emergency Alert Example</h2>
        <p className="mt-2 text-sm text-gray-700">Critical O_NEG request at City Hospital. Response needed within 45 minutes.</p>
        <button className="btn-primary mt-4">Respond Now</button>
      </div>
    </section>
  );
}
