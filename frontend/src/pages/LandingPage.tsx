import { Link } from 'react-router-dom';

export default function LandingPage() {
  const solvedChallenges = [
    {
      challenge: 'Slow emergency donor discovery',
      solution: 'Automatic donor matching now uses blood compatibility plus location filtering to mobilize donors faster.',
    },
    {
      challenge: 'No centralized, real-time system',
      solution: 'One platform now combines donors, hospitals, requests, inventory, appointments, and notifications.',
    },
    {
      challenge: 'Manual paperwork and communication delays',
      solution: 'Digital forms, role-based dashboards, and in-app alerts replace manual call chains.',
    },
    {
      challenge: 'Poor emergency response visibility',
      solution: 'Emergency requests are tracked by priority and status with auditable actions and operational alerts.',
    },
    {
      challenge: 'Weak donor engagement and retention',
      solution: 'Donors manage profile, eligibility, availability, and donation activity in one account.',
    },
    {
      challenge: 'Security and scalability concerns',
      solution: 'JWT auth, RBAC, validation, rate limiting, audit logs, and indexed PostgreSQL data model are in place.',
    },
  ];

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

      <div className="legacy-panel space-y-4">
        <h2 className="text-3xl font-bold text-primary">Challenges Solved In This Platform</h2>
        <p className="text-gray-700">
          Based on your reviewed research gaps, these are now implemented directly in this project.
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {solvedChallenges.map((item) => (
            <article key={item.challenge} className="rounded-lg border border-red-100 bg-white p-4 shadow-sm">
              <h3 className="text-lg font-bold text-primary">{item.challenge}</h3>
              <p className="mt-2 text-sm text-gray-700">{item.solution}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
