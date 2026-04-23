import { Link } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';

export default function LoginPage() {
  return (
    <LoginForm
      title="User Login"
      allowedRoles={['DONOR', 'HOSPITAL_STAFF']}
      subtitle="Sign in with your donor or hospital account."
      footer={
        <>
          <Link className="text-primary underline" to="/register">
            Create Account
          </Link>
          <Link className="text-primary underline" to="/">
            Back To Home
          </Link>
        </>
      }
    />
  );
}
