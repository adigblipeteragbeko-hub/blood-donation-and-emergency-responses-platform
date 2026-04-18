const bloodGroups = ['O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'];

export default function HospitalInventoryPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Blood Inventory</h1>
        <p className="text-sm text-muted">Manage blood units, view levels, and track expiry.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Blood Group
          <select className="legacy-input mt-1" defaultValue="">
            <option disabled value="">
              Select blood group
            </option>
            {bloodGroups.map((group) => (
              <option key={group} value={group}>
                {group}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Units
          <input className="legacy-input mt-1" min={1} type="number" />
        </label>
        <label className="text-sm font-semibold">
          Expiry Date
          <input className="legacy-input mt-1" type="date" />
        </label>
        <label className="text-sm font-semibold">
          Storage Note
          <input className="legacy-input mt-1" placeholder="Fridge/Batch note" type="text" />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" type="button">
          Add Inventory Record
        </button>
      </form>

      <div className="card">
        <h2 className="text-lg font-bold text-primary">Current Levels</h2>
        <p className="mt-2 text-sm text-muted">No inventory records yet. Add units to populate this table.</p>
      </div>
    </section>
  );
}

