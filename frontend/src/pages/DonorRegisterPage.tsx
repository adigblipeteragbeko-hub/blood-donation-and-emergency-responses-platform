import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { bloodGroups } from '../constants/blood-groups';
import { countryCodes } from '../constants/country-codes';

export default function DonorRegisterPage() {
  const navigate = useNavigate();
  const emptyForm = {
    fullName: '',
    email: '',
    bloodGroup: '',
    location: '',
    countryCode: '+233',
    phoneNumber: '',
    password: '',
  };
  const [form, setForm] = useState({
    ...emptyForm,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const timeout = setTimeout(() => setForm({ ...emptyForm }), 50);
    return () => clearTimeout(timeout);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        role: 'DONOR',
        donorProfile: {
          fullName: form.fullName,
          bloodGroup: form.bloodGroup,
          location: form.location,
          emergencyContactName: form.fullName,
          emergencyContactPhone: `${form.countryCode}${form.phoneNumber}`,
        },
      });
      setForm({ ...emptyForm });
      navigate('/verify-email', { state: { email: form.email, role: 'donor' } });
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Registration failed. Email might already exist.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="legacy-panel mx-auto max-w-3xl space-y-3">
      <h1 className="text-center text-5xl font-bold text-primary">Donor Registration</h1>
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form className="space-y-2" onSubmit={submit} autoComplete="off">
        <input
          className="legacy-input"
          name="donor_signup_fullname"
          autoComplete="off"
          placeholder="Full Name"
          value={form.fullName}
          onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
          pattern="[A-Za-z\s'-]+"
          title="Name should contain letters only"
          required
        />
        <input className="legacy-input" name="donor_signup_email" autoComplete="off" placeholder="Email Address" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
        <select className="legacy-input" name="donor_signup_blood_group" value={form.bloodGroup} onChange={(e) => setForm((v) => ({ ...v, bloodGroup: e.target.value }))} required>
          <option value="">Select Blood Group</option>
          {bloodGroups.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
        <input className="legacy-input" name="donor_signup_location" autoComplete="off" placeholder="Location" value={form.location} onChange={(e) => setForm((v) => ({ ...v, location: e.target.value }))} required />
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <select className="legacy-input" value={form.countryCode} onChange={(e) => setForm((v) => ({ ...v, countryCode: e.target.value }))}>
            {countryCodes.map((code) => (
              <option key={code.value} value={code.value}>
                {code.label}
              </option>
            ))}
          </select>
          <input
            className="legacy-input"
            name="donor_signup_phone"
            autoComplete="off"
            placeholder="Mobile Number"
            value={form.phoneNumber}
            onChange={(e) => setForm((v) => ({ ...v, phoneNumber: e.target.value.replace(/\D/g, '') }))}
            pattern="\d+"
            inputMode="numeric"
            title="Phone number should contain numbers only"
            required
          />
        </div>
        <input className="legacy-input" name="donor_signup_password" autoComplete="new-password" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70" disabled={submitting} type="submit">
          {submitting ? 'Registering...' : 'Register Donor'}
        </button>
      </form>
      <div className="flex justify-center gap-5 text-sm">
        <Link className="text-primary underline" to="/donor-login">
          Back to donor login
        </Link>
        <Link className="text-primary underline" to="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}
