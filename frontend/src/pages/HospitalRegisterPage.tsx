import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';

export default function HospitalRegisterPage() {
  const [form, setForm] = useState({
    hospitalId: '',
    hospitalName: '',
    email: '',
    address: '',
    inCharge: '',
    contact: '',
    password: '',
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

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
      setMessage('Hospital registration successful. You can now login as hospital.');
      setForm({ hospitalId: '', hospitalName: '', email: '', address: '', inCharge: '', contact: '', password: '' });
    } catch {
      setError('Registration failed. Email might already exist.');
    }
  };

  return (
    <section className="legacy-panel mx-auto max-w-3xl space-y-3">
      <h1 className="text-center text-5xl font-bold text-primary">Hospital Registration</h1>
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form className="space-y-2" onSubmit={submit}>
        <input className="legacy-input" placeholder="Hospital Id" value={form.hospitalId} onChange={(e) => setForm((v) => ({ ...v, hospitalId: e.target.value }))} required />
        <input className="legacy-input" placeholder="Name Of Hospital" value={form.hospitalName} onChange={(e) => setForm((v) => ({ ...v, hospitalName: e.target.value }))} required />
        <input className="legacy-input" placeholder="Email Address (Hospital)" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
        <input className="legacy-input" placeholder="Address of Hospital" value={form.address} onChange={(e) => setForm((v) => ({ ...v, address: e.target.value }))} required />
        <input className="legacy-input" placeholder="Name of applicant (In-charge)" value={form.inCharge} onChange={(e) => setForm((v) => ({ ...v, inCharge: e.target.value }))} required />
        <input className="legacy-input" placeholder="Contact Number (In-charge)" value={form.contact} onChange={(e) => setForm((v) => ({ ...v, contact: e.target.value }))} required />
        <input className="legacy-input" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
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
