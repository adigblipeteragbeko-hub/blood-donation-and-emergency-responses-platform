export default function DonorDashboardPage() {
  return (
    <section className="space-y-4">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Donor Dashboard</h1>
        <p className="text-sm text-gray-600">Welcome back. Track your eligibility, appointments, and emergency requests from one place.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="card">
          <p className="text-sm text-gray-500">Eligibility</p>
          <p className="text-2xl font-bold text-primary">Eligible</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Upcoming Appointments</p>
          <p className="text-2xl font-bold text-primary">1</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Emergency Alerts</p>
          <p className="text-2xl font-bold text-primary">2</p>
        </div>
        <div className="card">
          <p className="text-sm text-gray-500">Donations Completed</p>
          <p className="text-2xl font-bold text-primary">3</p>
        </div>
      </div>
    </section>
  );
}
