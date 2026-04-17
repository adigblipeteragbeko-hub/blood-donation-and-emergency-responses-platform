import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

type VerifyState = {
  email?: string;
  role?: 'donor' | 'hospital';
};

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as VerifyState | null) ?? null;

  const [email, setEmail] = useState(state?.email ?? '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    try {
      const response = await api.post('/auth/verify-email', { email, code });
      setMessage(response.data?.data?.message ?? 'Email verified successfully.');

      if (state?.role === 'hospital') {
        navigate('/hospital-login');
        return;
      }

      navigate('/donor-login');
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Verification failed. Check your code and try again.');
    }
  };

  const resend = async () => {
    setError('');
    setMessage('');

    try {
      const response = await api.post('/auth/resend-verification', { email });
      setMessage(response.data?.data?.message ?? 'Verification code sent.');
      setSecondsLeft(10 * 60);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not resend code.');
    }
  };

  return (
    <section className="legacy-panel mx-auto w-full max-w-xl space-y-3">
      <h1 className="text-center text-4xl font-bold text-primary">Verify Email</h1>
      <p className="text-center text-sm text-gray-700">Enter the 6-digit code sent to your email address.</p>
      <p className="text-center text-sm font-semibold text-primary">Code expires in {minutes}:{seconds}</p>
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <form className="space-y-2" onSubmit={submit}>
        <input
          className="legacy-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="legacy-input"
          placeholder="Verification code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          required
        />
        <button className="btn-primary w-full" type="submit">
          Verify Email
        </button>
      </form>

      <div className="flex justify-center gap-5 text-sm">
        <button className="text-primary underline" onClick={resend} type="button">
          Resend Code
        </button>
        <Link className="text-primary underline" to="/donor-login">
          Back To Login
        </Link>
      </div>
    </section>
  );
}
