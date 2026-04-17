import { Link } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';

export default function DonorLoginPage() {
  return (
    <LoginForm
      title="Donor Login"
      expectedRole="DONOR"
      subtitle="Access donor dashboard to track donations and alerts."
      footer={
        <>
          <Link className="text-primary underline" to="/donor-register">
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
