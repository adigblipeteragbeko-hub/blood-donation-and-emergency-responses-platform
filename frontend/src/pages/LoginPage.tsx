import { Link } from 'react-router-dom';
import { LoginForm } from '../components/LoginForm';

export default function LoginPage() {
  return (
    <LoginForm
      title="User Login"
      subtitle="Sign in once. We will send you to the right dashboard for your role."
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
