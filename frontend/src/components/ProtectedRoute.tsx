import { Navigate, Outlet } from 'react-router-dom';
import { Role } from '../types/auth';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ roles }: { roles?: Role[] }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (roles && !roles.includes(user.role)) {
    if (user.role === 'DONOR') {
      return <Navigate to="/donor/dashboard" replace />;
    }
    if (['HOSPITAL_ADMIN', 'HOSPITAL_STAFF', 'INVENTORY_OFFICER', 'DONOR_REVIEW_OFFICER'].includes(user.role)) {
      return <Navigate to="/hospital/dashboard" replace />;
    }
    return <Navigate to="/admin/dashboard" replace />;
  }

  return <Outlet />;
}
