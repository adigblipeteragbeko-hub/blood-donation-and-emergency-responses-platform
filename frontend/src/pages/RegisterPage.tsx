import { Link } from 'react-router-dom';

export default function RegisterPage() {
  return (
    <section className="mx-auto grid max-w-4xl gap-6 md:grid-cols-2">
      <article className="card space-y-3">
        <h1 className="text-2xl font-bold text-primary">Register As Donor</h1>
        <p className="text-sm text-muted">Create a donor account to receive alerts and manage donation activity.</p>
        <Link className="btn-primary inline-flex" to="/donor-register">
          Continue Donor Registration
        </Link>
      </article>
      <article className="card space-y-3">
        <h2 className="text-2xl font-bold text-primary">Register As Hospital</h2>
        <p className="text-sm text-muted">Create a hospital account to manage requests, inventory, and responses.</p>
        <Link className="btn-primary inline-flex" to="/hospital-register">
          Continue Hospital Registration
        </Link>
      </article>
    </section>
  );
}
