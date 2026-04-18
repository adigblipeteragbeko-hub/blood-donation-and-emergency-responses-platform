import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { countryCodes } from '../constants/country-codes';

export default function HospitalRegisterPage() {
  const navigate = useNavigate();
  const emptyForm = {
    hospitalName: '',
    email: '',
    address: '',
    inCharge: '',
    contactCode: '+233',
    contactNumber: '',
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
        role: 'HOSPITAL_STAFF',
      });
      setForm({ ...emptyForm });
      navigate('/verify-email', { state: { email: form.email, role: 'hospital' } });
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
      <h1 className="text-center text-5xl font-bold text-primary">Hospital Registration</h1>
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form className="space-y-2" onSubmit={submit} autoComplete="off">
        <input
          className="legacy-input"
          name="hospital_signup_name"
          autoComplete="off"
          placeholder="Name Of Hospital"
          value={form.hospitalName}
          onChange={(e) => setForm((v) => ({ ...v, hospitalName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
          pattern="[A-Za-z\s'-]+"
          title="Name should contain letters only"
          required
        />
        <input className="legacy-input" name="hospital_signup_email" autoComplete="off" placeholder="Email Address (Hospital)" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
        <input className="legacy-input" name="hospital_signup_address" autoComplete="off" placeholder="Address of Hospital" value={form.address} onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))} required />
        <input
          className="legacy-input"
          name="hospital_signup_in_charge"
          autoComplete="off"
          placeholder="Name of applicant (In-charge)"
          value={form.inCharge}
          onChange={(e) => setForm((v) => ({ ...v, inCharge: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
          pattern="[A-Za-z\s'-]+"
          title="Name should contain letters only"
          required
        />
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <select className="legacy-input" value={form.contactCode} onChange={(e) => setForm((v) => ({ ...v, contactCode: e.target.value }))}>
            {countryCodes.map((code) => (
              <option key={code.value} value={code.value}>
                {code.label}
              </option>
            ))}
          </select>
          <input
            className="legacy-input"
            name="hospital_signup_contact"
            autoComplete="off"
            placeholder="Contact Number (In-charge)"
            value={form.contactNumber}
            onChange={(e) => setForm((v) => ({ ...v, contactNumber: e.target.value.replace(/\D/g, '') }))}
            pattern="\d+"
            inputMode="numeric"
            title="Contact number should contain numbers only"
            required
          />
        </div>
        <input className="legacy-input" name="hospital_signup_password" autoComplete="new-password" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70" disabled={submitting} type="submit">
          {submitting ? 'Registering...' : 'Register Hospital'}
        </button>
      </form>
      <div className="flex justify-center gap-5 text-sm">
        <Link className="text-primary underline" to="/hospital-login">
          Back to hospital login
        </Link>
        <Link className="text-primary underline" to="/">
          Back to home
        </Link>
      </div>
    </section>
  );
}
