import { Link } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';
import { HOSPITAL_PORTAL_ROLES } from '../types/auth';

export default function HospitalLoginPage() {
  return (
    <LoginForm
      title="Hospital Login"
      allowedRoles={HOSPITAL_PORTAL_ROLES}
      subtitle="Hospital staff sign in for requests and inventory tracking."
      footer={
        <>
          <Link className="text-primary underline" to="/hospital-register">
            New Registration
          </Link>
          <Link className="text-primary underline" to="/">
            Back To Home
          </Link>
        </>
      }
    />
  );
}
