export default function HospitalProfilePage() {
  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Profile / Hospital Info</h1>
        <p className="text-sm text-muted">Update hospital profile, location, and contact information.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Hospital Name
          <input className="legacy-input mt-1" type="text" />
        </label>
        <label className="text-sm font-semibold">
          Hospital Email
          <input className="legacy-input mt-1" type="email" />
        </label>
        <label className="text-sm font-semibold">
          Contact Number
          <input className="legacy-input mt-1" placeholder="+233..." type="tel" />
        </label>
        <label className="text-sm font-semibold">
          City
          <input className="legacy-input mt-1" type="text" />
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Address
          <textarea className="legacy-input mt-1 min-h-24" />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" type="button">
          Update Hospital Profile
        </button>
      </form>
    </section>
  );
}

