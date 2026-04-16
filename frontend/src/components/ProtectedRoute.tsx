import { Navigate, Outlet } from 'react-router-dom';
import { Role } from '../types/auth';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/donor-login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
