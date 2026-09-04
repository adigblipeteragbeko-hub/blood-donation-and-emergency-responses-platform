import { FormEvent, useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';

type VerifyState = {
  email?: string;
  role?: 'donor' | 'hospital';
  verificationMethod?: 'EMAIL' | 'SMS';
  maskedDestination?: string;
  expiresInMinutes?: number;
};

export default function VerifyEmailPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const state = (location.state as VerifyState | null) ?? null;

  const [email, setEmail] = useState(state?.email ?? '');
  const [code, setCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [verificationMethod, setVerificationMethod] = useState<'EMAIL' | 'SMS'>(state?.verificationMethod ?? 'EMAIL');
  const [maskedDestination, setMaskedDestination] = useState(state?.maskedDestination ?? '');
  const [secondsLeft, setSecondsLeft] = useState((state?.expiresInMinutes ?? 5) * 60);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [verified, setVerified] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => {
      setSecondsLeft((prev) => (prev > 0 ? prev - 1 : 0));
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  const minutes = String(Math.floor(secondsLeft / 60)).padStart(2, '0');
  const seconds = String(secondsLeft % 60).padStart(2, '0');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (submitting || verified) return;
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await api.post('/auth/verify-email', { email, code });
      setVerified(true);
      setMessage('Account Verified Successfully! Your account has been successfully verified. You can now log in.');
      window.setTimeout(() => {
        navigate(state?.role === 'hospital' ? '/hospital-login' : '/donor-login');
      }, 2500);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Verification failed. Check your code and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const requestCode = async (method: 'EMAIL' | 'SMS') => {
    if (submitting || verified) return;
    setError('');
    setMessage('');

    try {
      const response = await api.post('/auth/resend-verification', { email, method });
      const nextMethod = response.data?.data?.verificationMethod ?? method;
      setVerificationMethod(nextMethod);
      setMaskedDestination(response.data?.data?.maskedDestination ?? '');
      setCode('');
      setMessage(response.data?.data?.message ?? 'Verification code sent.');
      setSecondsLeft((response.data?.data?.expiresInMinutes ?? 5) * 60);
      setResendCooldown(response.data?.data?.resendCooldownSeconds ?? 45);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not resend code.');
    }
  };

  return (
    <section className="legacy-panel mx-auto w-full max-w-xl space-y-3">
      <h1 className="text-center text-4xl font-bold text-primary">Verify Email</h1>
      <p className="text-center text-sm text-gray-700">Enter the 6-digit verification code.</p>
      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
        <p className="font-bold text-slate-900">Code sent by {verificationMethod === 'SMS' ? 'SMS' : 'Email'}{maskedDestination ? ` to ${maskedDestination}` : ''}</p>
        <p>Your verification code expires in 5 minutes. Do not share it with anyone.</p>
        <p className="mt-2 font-semibold">Didn&apos;t receive it?</p>
        <div className="mt-2 flex flex-wrap gap-2">
          <button className="rounded bg-white px-3 py-1 text-primary underline disabled:cursor-not-allowed disabled:text-slate-400" disabled={resendCooldown > 0 || submitting || verified} type="button" onClick={() => void requestCode(verificationMethod)}>
            {verificationMethod === 'SMS' ? 'Resend by SMS' : 'Resend by Email'}
          </button>
          <button className="rounded bg-white px-3 py-1 text-primary underline disabled:cursor-not-allowed disabled:text-slate-400" disabled={resendCooldown > 0 || submitting || verified} type="button" onClick={() => void requestCode(verificationMethod === 'SMS' ? 'EMAIL' : 'SMS')}>
            {verificationMethod === 'SMS' ? 'Send by Email' : 'Send by SMS'}
          </button>
        </div>
      </div>
      <p className="text-center text-sm font-semibold text-primary">Code expires in {minutes}:{seconds}</p>
      {message ? (
        <div
          className="flex items-start gap-3 rounded-2xl border border-green-200 bg-green-50 p-4 text-sm text-green-800"
          role="status"
          aria-live="polite"
        >
          {verified ? (
            <span
              aria-hidden="true"
              className="mt-0.5 inline-flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-green-600 text-sm font-black text-white"
            >
              ✓
            </span>
          ) : null}
          <div>
            <p className="font-black">{verified ? 'Account Verified Successfully!' : message}</p>
            {verified ? (
              <>
                <p className="mt-1">Your account has been successfully verified. You can now log in.</p>
                <p className="mt-1 text-xs font-bold">Redirecting you to login...</p>
              </>
            ) : null}
          </div>
        </div>
      ) : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <form className="space-y-2" onSubmit={submit}>
        <input
          className="legacy-input"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting || verified}
          required
        />
        <input
          className="legacy-input"
          placeholder="Verification code"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
          disabled={submitting || verified}
          required
        />
        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70" disabled={submitting || verified} type="submit">
          {submitting ? 'Verifying...' : verified ? 'Verified' : 'Verify Email'}
        </button>
      </form>

      <div className="flex justify-center gap-5 text-sm">
        <button className="text-primary underline disabled:cursor-not-allowed disabled:text-slate-400" disabled={resendCooldown > 0 || submitting || verified} onClick={() => void requestCode(verificationMethod)} type="button">
          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : `Resend by ${verificationMethod === 'SMS' ? 'SMS' : 'Email'}`}
        </button>
        <Link className="text-primary underline" to="/donor-login">
          Back to Login
        </Link>
      </div>
    </section>
  );
}
