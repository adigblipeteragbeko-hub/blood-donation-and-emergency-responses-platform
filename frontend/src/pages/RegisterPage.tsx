import { Link } from 'react-router-dom';
import { AppIcon } from '../components/ui/AppIcon';

export default function RegisterPage() {
  return (
    <section className="mx-auto max-w-5xl px-4 py-4 sm:px-6">
      <div className="grid gap-6 md:grid-cols-2">
      <article className="card space-y-3">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-primary">
          <AppIcon name="heart" className="h-5 w-5" />
          Donor Registration
        </h1>
        <p className="text-sm text-muted">Create a donor account for alerts and donation activity.</p>
        <Link className="btn-primary inline-flex items-center gap-2" to="/donor-register">
          <AppIcon name="form" className="h-4 w-4" />
          Continue
        </Link>
      </article>
      <article className="card space-y-3">
        <h2 className="flex items-center gap-2 text-2xl font-bold text-primary">
          <AppIcon name="hospital" className="h-5 w-5" />
          Hospital Registration
        </h2>
        <p className="text-sm text-muted">Create a hospital account for requests, inventory, and responses.</p>
        <Link className="btn-primary inline-flex items-center gap-2" to="/hospital-register">
          <AppIcon name="form" className="h-4 w-4" />
          Continue
        </Link>
      </article>
      </div>
    </section>
  );
}
