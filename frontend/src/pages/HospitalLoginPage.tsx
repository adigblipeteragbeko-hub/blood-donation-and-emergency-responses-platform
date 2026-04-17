import { Link } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';

export default function HospitalLoginPage() {
  return (
    <LoginForm
      title="Hospital Login"
      expectedRole="HOSPITAL_STAFF"
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
