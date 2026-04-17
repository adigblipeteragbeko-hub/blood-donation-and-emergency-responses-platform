import { FormEvent, ReactNode, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type Role = 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF';

export function LoginForm({
  title,
  expectedRole,
  subtitle,
  footer,
}: {
  title: string;
  expectedRole?: Role;
  subtitle?: string;
  footer?: ReactNode;
}) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    try {
      await login(email, password);
      const rawUser = localStorage.getItem('user');
      const nextRole = rawUser ? (JSON.parse(rawUser) as { role?: string }).role : undefined;

      if (expectedRole && nextRole !== expectedRole) {
        logout();
        setError(`This login is for ${expectedRole === 'HOSPITAL_STAFF' ? 'Hospital' : expectedRole} accounts only.`);
        return;
      }

      if (nextRole === 'ADMIN') {
        navigate('/admin/management');
      } else {
        navigate('/dashboard');
      }
    } catch {
      setError('Login failed. Check credentials and try again.');
    }
  };

  return (
    <form onSubmit={submit} className="legacy-panel mx-auto w-full max-w-xl space-y-3">
      <h1 className="text-center text-4xl font-bold text-primary">{title}</h1>
      {subtitle ? <p className="text-center text-sm text-muted">{subtitle}</p> : null}
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <label className="block text-sm font-semibold">
        Email
        <input
          className="legacy-input mt-1"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input
          className="legacy-input mt-1"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button className="btn-primary w-full" type="submit">
        Login
      </button>
      {footer ? <div className="flex justify-center gap-5 pt-1 text-sm">{footer}</div> : null}
    </form>
  );
}
