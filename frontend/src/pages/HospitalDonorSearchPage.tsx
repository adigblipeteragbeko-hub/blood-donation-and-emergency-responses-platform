export default function HospitalDonorSearchPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Donor Search</h1>
        <p className="text-sm text-muted">Find matching donors by blood group and location.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-3">
        <label className="text-sm font-semibold">
          Blood Group
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
          City / Location
          <input className="legacy-input mt-1" type="text" />
        </label>
        <label className="text-sm font-semibold">
          Radius (km)
          <input className="legacy-input mt-1" min={1} type="number" />
        </label>
        <button className="btn-primary md:col-span-3 md:w-fit" type="button">
          Search Donors
        </button>
      </form>

      <div className="card">
        <h2 className="text-lg font-bold text-primary">Matching Donors</h2>
        <p className="mt-2 text-sm text-muted">No donor matches yet. Run a search to find available donors.</p>
      </div>
    </section>
  );
}

