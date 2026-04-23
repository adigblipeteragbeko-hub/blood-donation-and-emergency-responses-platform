import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type Role = 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF';

export function LoginForm({
  title,
  expectedRole,
  allowedRoles,
  subtitle,
  footer,
}: {
  title: string;
  expectedRole?: Role;
  allowedRoles?: Role[];
  subtitle?: string;
  footer?: ReactNode;
}) {
  const { login, logout } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setEmail('');
      setPassword('');
    }, 50);
    return () => clearTimeout(timeout);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      await login(email, password);
      const rawUser = localStorage.getItem('user');
      const nextRole = rawUser ? (JSON.parse(rawUser) as { role?: string }).role : undefined;

      if (expectedRole && nextRole !== expectedRole) {
        logout();
        setError(`This login is for ${expectedRole === 'HOSPITAL_STAFF' ? 'Hospital' : expectedRole} accounts only.`);
        return;
      }

      if (allowedRoles && nextRole && !allowedRoles.includes(nextRole as Role)) {
        logout();
        setError('This login is not available for your account role.');
        return;
      }

      if (nextRole === 'ADMIN') {
        navigate('/admin/dashboard');
      } else if (nextRole === 'DONOR') {
        navigate('/dashboard/donor');
      } else if (nextRole === 'HOSPITAL_STAFF') {
        navigate('/dashboard/hospital');
      } else {
        navigate('/login');
      }
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Login failed. Check credentials and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={submit} autoComplete="off" className="legacy-panel mx-auto w-full max-w-xl space-y-3">
      <h1 className="text-center text-4xl font-bold text-primary">{title}</h1>
      {subtitle ? <p className="text-center text-sm text-muted">{subtitle}</p> : null}
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <label className="block text-sm font-semibold">
        Email
        <input
          className="legacy-input mt-1"
          type="email"
          name={`manual_email_${title.replace(/\s+/g, '_').toLowerCase()}`}
          autoComplete="off"
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
          name={`manual_password_${title.replace(/\s+/g, '_').toLowerCase()}`}
          autoComplete="new-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70" disabled={submitting} type="submit">
        {submitting ? 'Signing in...' : 'Login'}
      </button>
      {footer ? <div className="flex justify-center gap-5 pt-1 text-sm">{footer}</div> : null}
    </form>
  );
}
