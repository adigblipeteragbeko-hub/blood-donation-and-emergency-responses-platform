import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function DonorRegisterPage() {
  const emptyForm = {
    username: '',
    email: '',
    age: '',
    weight: '',
    address: '',
    phone: '',
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
        role: 'DONOR',
      });
      setMessage('Registration successful. You can now login as donor.');
      setForm({ ...emptyForm });
    } catch {
      setError('Registration failed. Email might already exist.');
    }
  };

  return (
    <section className="legacy-panel mx-auto max-w-3xl space-y-3">
      <h1 className="text-center text-5xl font-bold text-primary">Donor Registration</h1>
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form className="space-y-2" onSubmit={submit} autoComplete="off">
        <input className="legacy-input" name="donor_signup_username" autoComplete="off" placeholder="Username" value={form.username} onChange={(e) => setForm((v) => ({ ...v, username: e.target.value }))} required />
        <input className="legacy-input" name="donor_signup_email" autoComplete="off" placeholder="Email Address" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
        <input className="legacy-input" name="donor_signup_age" autoComplete="off" placeholder="Enter Age" value={form.age} onChange={(e) => setForm((v) => ({ ...v, age: e.target.value }))} required />
        <input className="legacy-input" name="donor_signup_weight" autoComplete="off" placeholder="Enter Weight (kg)" value={form.weight} onChange={(e) => setForm((v) => ({ ...v, weight: e.target.value }))} required />
        <input className="legacy-input" name="donor_signup_address" autoComplete="off" placeholder="Enter your address" value={form.address} onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))} required />
        <input className="legacy-input" name="donor_signup_phone" autoComplete="off" placeholder="Enter Mobile Number" value={form.phone} onChange={(e) => setForm((v) => ({ ...v, phone: e.target.value }))} required />
        <input className="legacy-input" name="donor_signup_password" autoComplete="new-password" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
        <button className="btn-primary w-full" type="submit">
          Register Donor
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
