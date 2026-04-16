import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

type Role = 'ADMIN' | 'DONOR' | 'HOSPITAL_STAFF';

export function LoginForm({ title, expectedRole }: { title: string; expectedRole?: Role }) {
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
    <form onSubmit={submit} className="card mx-auto w-full max-w-md space-y-3">
      <h1 className="text-xl font-bold text-primary">{title}</h1>
      {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
      <label className="block text-sm font-semibold">
        Email
        <input
          className="mt-1 w-full rounded border border-gray-300 p-2"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          required
        />
      </label>
      <label className="block text-sm font-semibold">
        Password
        <input
          className="mt-1 w-full rounded border border-gray-300 p-2"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          required
        />
      </label>
      <button className="btn-primary w-full" type="submit">
        Sign In
      </button>
    </form>
  );
}
