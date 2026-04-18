export default function HospitalEmergencyRequestsPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Emergency Requests</h1>
        <p className="text-sm text-muted">Create high-priority requests and broadcast urgent alerts quickly.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Emergency Blood Group
          <select className="legacy-input mt-1" defaultValue="">
            <option disabled value="">
              Select blood group
            </option>
            <option value="O_POS">O_POS</option>
            <option value="O_NEG">O_NEG</option>
            <option value="A_POS">A_POS</option>
            <option value="A_NEG">A_NEG</option>
            <option value="B_POS">B_POS</option>
            <option value="B_NEG">B_NEG</option>
            <option value="AB_POS">AB_POS</option>
            <option value="AB_NEG">AB_NEG</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Units Needed
          <input className="legacy-input mt-1" min={1} type="number" />
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Emergency Details
          <textarea className="legacy-input mt-1 min-h-24" />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" type="button">
          Broadcast Emergency Alert
        </button>
      </form>
    </section>
  );
}

