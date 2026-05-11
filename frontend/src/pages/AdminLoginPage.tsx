import { Link } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { ADMIN_PORTAL_ROLES } from '../types/auth';

export default function AdminLoginPage() {
  return (
    <LoginForm
      title="Admin Login"
      allowedRoles={ADMIN_PORTAL_ROLES}
      subtitle="Admin access for user, donor, and hospital management."
      footer={
        <Link className="text-primary underline" to="/">
          Back To Home
        </Link>
      }
    />
  );
}
