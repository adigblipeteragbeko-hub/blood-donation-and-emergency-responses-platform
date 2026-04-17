import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';

export default function HospitalRegisterPage() {
  const navigate = useNavigate();
  const emptyForm = {
    hospitalName: '',
    email: '',
    address: '',
    inCharge: '',
    contact: '',
    password: '',
  };
  const [form, setForm] = useState({
    ...emptyForm,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    const timeout = setTimeout(() => setForm({ ...emptyForm }), 50);
    return () => clearTimeout(timeout);
  }, []);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');

    try {
      await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        role: 'HOSPITAL_STAFF',
      });
      setForm({ ...emptyForm });
      navigate('/verify-email', { state: { email: form.email, role: 'hospital' } });
    } catch {
      setError('Registration failed. Email might already exist.');
    }
  };

  return (
    <section className="legacy-panel mx-auto max-w-3xl space-y-3">
      <h1 className="text-center text-5xl font-bold text-primary">Hospital Registration</h1>
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form className="space-y-2" onSubmit={submit} autoComplete="off">
        <input className="legacy-input" name="hospital_signup_name" autoComplete="off" placeholder="Name Of Hospital" value={form.hospitalName} onChange={(e) => setForm((v) => ({ ...v, hospitalName: e.target.value }))} required />
        <input className="legacy-input" name="hospital_signup_email" autoComplete="off" placeholder="Email Address (Hospital)" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
        <input className="legacy-input" name="hospital_signup_address" autoComplete="off" placeholder="Address of Hospital" value={form.address} onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))} required />
        <input className="legacy-input" name="hospital_signup_in_charge" autoComplete="off" placeholder="Name of applicant (In-charge)" value={form.inCharge} onChange={(e) => setForm((v) => ({ ...v, inCharge: e.target.value }))} required />
        <input className="legacy-input" name="hospital_signup_contact" autoComplete="off" placeholder="Contact Number (In-charge)" value={form.contact} onChange={(e) => setForm((v) => ({ ...v, contact: e.target.value }))} required />
        <input className="legacy-input" name="hospital_signup_password" autoComplete="new-password" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
        <button className="btn-primary w-full" type="submit">
          Register Hospital
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
