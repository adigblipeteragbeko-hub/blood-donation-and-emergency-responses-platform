export default function HospitalAppointmentsPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Appointments</h1>
        <p className="text-sm text-muted">Schedule, confirm, and cancel donor appointments.</p>
      </div>

      <div className="card">
        <h2 className="text-lg font-bold text-primary">Appointment Calendar</h2>
        <p className="mt-2 text-sm text-muted">No appointments scheduled yet.</p>
        <div className="mt-4 flex gap-2">
          <button className="btn-primary" type="button">
            Schedule Appointment
          </button>
          <button className="rounded-lg border border-primary px-4 py-2 text-sm font-semibold text-primary" type="button">
            Confirm / Cancel
          </button>
        </div>
      </div>
    </section>
  );
}

