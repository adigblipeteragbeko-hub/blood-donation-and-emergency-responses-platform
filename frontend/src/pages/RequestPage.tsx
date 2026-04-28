import { Link, Navigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export default function RequestPage() {
  const { user } = useAuth();

  if (!user) {
    return (
      <section className="card mx-auto max-w-2xl space-y-4 text-center">
        <h1 className="text-2xl font-bold text-primary">Account Required</h1>
        <p className="text-sm text-muted">You must sign in before creating or managing blood requests.</p>
        <div className="flex flex-wrap justify-center gap-3">
          <Link className="btn-primary" to="/login">
            Login
          </Link>
          <Link className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-primary" to="/register">
            Create Account
          </Link>
        </div>
      </section>
    );
  }

  if (user.role === 'HOSPITAL_STAFF') {
    return <Navigate to="/hospital/request-blood" replace />;
  }

  if (user.role === 'ADMIN') {
    return <Navigate to="/admin/dashboard" replace />;
  }

  return (
    <section className="card mx-auto max-w-2xl space-y-4 text-center">
      <h1 className="text-2xl font-bold text-primary">Hospital Staff Only</h1>
      <p className="text-sm text-muted">Blood request creation is available to authenticated hospital staff accounts.</p>
      <Link className="btn-primary" to="/dashboard/donor">
        Go To Donor Dashboard
      </Link>
    </section>
  );
}
