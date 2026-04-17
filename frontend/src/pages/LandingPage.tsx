import { Link } from 'react-router-dom';

export default function LandingPage() {
  return (
    <section className="space-y-6">
      <div className="legacy-panel grid gap-6 md:grid-cols-2 md:items-center">
        <div className="space-y-4">
          <h1 className="legacy-title">DONATE BLOOD!!!</h1>
          <p className="text-lg text-gray-700">
            If you are a blood donor, you are a hero to someone waiting for a second chance at life.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link className="btn-primary" to="/donor-register">
              Donor Registration
            </Link>
            <Link className="rounded-lg border border-primary px-4 py-2 font-semibold text-primary" to="/request">
              Send Request
            </Link>
          </div>
        </div>
        <div className="overflow-hidden rounded-xl border border-red-200 bg-white shadow-sm">
          <img
            alt="Blood donation"
            className="h-72 w-full object-cover"
            src="https://images.unsplash.com/photo-1615461066841-6116e61058f4?auto=format&fit=crop&w=1200&q=80"
          />
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="legacy-panel">
          <h3 className="mb-2 text-xl font-bold text-primary">Donors</h3>
          <p className="text-gray-700">Register, manage eligibility, and respond to emergency blood alerts.</p>
        </div>
        <div className="legacy-panel">
          <h3 className="mb-2 text-xl font-bold text-primary">Hospitals</h3>
          <p className="text-gray-700">Create blood requests and monitor inventory fulfillment in real time.</p>
        </div>
        <div className="legacy-panel">
          <h3 className="mb-2 text-xl font-bold text-primary">Emergency</h3>
          <p className="text-gray-700">Urgent requests are matched quickly by blood group and location.</p>
        </div>
      </div>
    </section>
  );
}
