import { Navigate, Outlet } from 'react-router-dom';
import { Role } from '../types/auth';
import { useAuth } from '../hooks/useAuth';
import { getRoleLandingPath } from '../utils/role-redirect';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="rounded-2xl border border-red-100 bg-white px-6 py-5 text-sm font-semibold text-slate-700 shadow-lg">
          Restoring secure session...
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={getRoleLandingPath(user.role)} replace />;
  }

  return <Outlet />;
}
