import { Link } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';

export default function AdminLoginPage() {
  return (
    <LoginForm
      title="Admin Login"
      expectedRole="ADMIN"
      subtitle="Admin access for user, donor, and hospital management."
      footer={
        <Link className="text-primary underline" to="/">
          Back To Home
        </Link>
      }
    />
  );
}
