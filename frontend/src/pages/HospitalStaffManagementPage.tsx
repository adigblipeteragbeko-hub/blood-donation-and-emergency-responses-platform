export default function HospitalStaffManagementPage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Staff Management</h1>
        <p className="text-sm text-muted">Add and manage hospital staff accounts and role permissions.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Full Name
          <input className="legacy-input mt-1" type="text" />
        </label>
        <label className="text-sm font-semibold">
          Staff Email
          <input className="legacy-input mt-1" type="email" />
        </label>
        <label className="text-sm font-semibold">
          Role
          <select className="legacy-input mt-1" defaultValue="">
            <option disabled value="">
              Select role
            </option>
            <option value="COORDINATOR">Coordinator</option>
            <option value="LAB_TECH">Lab Tech</option>
            <option value="NURSE">Nurse</option>
            <option value="ADMIN">Admin</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Phone
          <input className="legacy-input mt-1" type="tel" />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" type="button">
          Add Staff Member
        </button>
      </form>

      <div className="card">
        <h2 className="text-lg font-bold text-primary">Hospital Staff List</h2>
        <p className="mt-2 text-sm text-muted">No staff accounts added yet.</p>
      </div>
    </section>
  );
}

