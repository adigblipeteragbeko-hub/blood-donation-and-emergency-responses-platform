import { FormEvent, ReactNode, useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import api from '../services/api';
import { Role } from '../types/auth';
import { getRoleLandingPath } from '../utils/role-redirect';
import { AppIcon } from './ui/AppIcon';

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
  const location = useLocation();
  const prefilledEmail = new URLSearchParams(location.search).get('email') ?? '';
  const [email, setEmail] = useState(prefilledEmail);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [resendingVerification, setResendingVerification] = useState(false);
  const isVerificationError = error.toLowerCase().includes('verify') || error.toLowerCase().includes('verification');

  useEffect(() => {
    const timeout = setTimeout(() => {
      setEmail(prefilledEmail);
      setPassword('');
    }, 50);
    return () => clearTimeout(timeout);
  }, [prefilledEmail]);

  const getDonorLandingPath = async () => {
    try {
      const response = await api.get('/donor-clinical-records/me');
      const workspace = response.data?.data ?? response.data;
      const latest = workspace?.latest as { status?: string } | null | undefined;
      const nextEligibilityDate = workspace?.donorProfile?.nextEligibilityDate
        ? new Date(workspace.donorProfile.nextEligibilityDate)
        : null;
      const canReassessAfterDeferral =
        latest?.status === 'TEMPORARILY_DEFERRED' &&
        nextEligibilityDate &&
        !Number.isNaN(nextEligibilityDate.getTime()) &&
        nextEligibilityDate <= new Date();

      if (!latest || latest.status === 'DRAFT' || canReassessAfterDeferral) {
        return '/donor/health-form?required=1';
      }
      if (latest.status !== 'APPROVED') {
        return '/donor/eligibility';
      }
    } catch {
      return '/donor/dashboard';
    }
    return '/donor/dashboard';
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password.trim()) {
      setError('Please enter your email and password.');
      return;
    }

    setSubmitting(true);

    try {
      await login(email, password);
      const rawUser = localStorage.getItem('user');
      const nextRole = rawUser ? (JSON.parse(rawUser) as { role?: string }).role : undefined;

      if (expectedRole && nextRole !== expectedRole) {
        logout();
        setError(`This login is for ${expectedRole === 'HOSPITAL_ADMIN' ? 'Hospital' : expectedRole} accounts only.`);
        return;
      }

      if (allowedRoles && nextRole && !allowedRoles.includes(nextRole as Role)) {
        logout();
        setError('This login is not available for your account role.');
        return;
      }

      navigate(nextRole === 'DONOR' ? await getDonorLandingPath() : getRoleLandingPath(nextRole as Role));
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Invalid email or password. Please check your details and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const resendVerification = async () => {
    if (!email.trim()) {
      setError('Enter your email address first, then request a verification code.');
      return;
    }

    try {
      setResendingVerification(true);
      const response = await api.post('/auth/resend-verification', { email });
      setError('');
      const message = response.data?.data?.message ?? 'If verification is pending, a new code has been sent.';
      alert(message);
      navigate('/verify-email', {
        state: {
          email,
          verificationMethod: response.data?.data?.verificationMethod ?? 'EMAIL',
          maskedDestination: response.data?.data?.maskedDestination,
          expiresInMinutes: response.data?.data?.expiresInMinutes ?? 5,
        },
      });
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not request a new verification code. Please try again or contact support.');
    } finally {
      setResendingVerification(false);
    }
  };

  return (
    <div className="flex min-h-[72vh] items-center justify-center px-4 py-8 sm:px-6">
      <form
        onSubmit={submit}
        autoComplete="off"
        className="legacy-panel mx-auto w-full max-w-2xl space-y-4 rounded-2xl shadow-sm"
      >
        <h1 className="flex items-center justify-center gap-2 text-center text-3xl font-bold text-primary sm:text-4xl">
          <AppIcon name="users" className="h-6 w-6" />
          {title}
        </h1>
        {subtitle ? <p className="text-center text-sm text-muted">{subtitle}</p> : null}
        {error && <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p>}
        {isVerificationError ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            <p className="font-bold">Account verification is required before sign in.</p>
            <p className="mt-1">If the code did not arrive, request a new code, switch delivery method on the verification page, or ask an administrator to verify your account after confirming your identity.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="rounded-xl bg-amber-600 px-3 py-2 text-xs font-bold text-white disabled:cursor-not-allowed disabled:opacity-60"
                disabled={resendingVerification}
                onClick={resendVerification}
                type="button"
              >
                {resendingVerification ? 'Sending...' : 'Resend Verification Code'}
              </button>
              <button
                className="rounded-xl border border-amber-300 px-3 py-2 text-xs font-bold"
                onClick={() => navigate('/verify-email', { state: { email } })}
                type="button"
              >
                Enter Code
              </button>
            </div>
          </div>
        ) : null}
        <label className="block text-sm font-semibold">
          Email
          <input
            className="legacy-input mt-1"
            type="email"
            name={`manual_email_${title.replace(/\s+/g, '_').toLowerCase()}`}
            autoComplete="off"
            placeholder="Email address"
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
            placeholder="Password"
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
    </div>
  );
}
