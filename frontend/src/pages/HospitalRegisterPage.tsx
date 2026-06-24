import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { countryCodes } from '../constants/country-codes';
import { AppIcon } from '../components/ui/AppIcon';
import { HospitalLocationPicker } from '../components/ui/HospitalLocationPicker';

export default function HospitalRegisterPage() {
  const navigate = useNavigate();
  const emptyForm = {
    hospitalName: '',
    email: '',
    address: '',
    city: '',
    region: '',
    latitude: '',
    longitude: '',
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
  const [capturingLocation, setCapturingLocation] = useState(false);
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

    const latitude = form.latitude.trim() ? Number(form.latitude) : undefined;
    const longitude = form.longitude.trim() ? Number(form.longitude) : undefined;
    if (!form.city.trim() || !form.region.trim()) {
      setError('City and region are required for emergency requests and live map coordination.');
      setSubmitting(false);
      return;
    }
    if (latitude === undefined || longitude === undefined) {
      setError('Please select the hospital location on the map.');
      setSubmitting(false);
      return;
    }
    if (latitude !== undefined && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
      setError('Latitude must be between -90 and 90.');
      setSubmitting(false);
      return;
    }
    if (longitude !== undefined && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
      setError('Longitude must be between -180 and 180.');
      setSubmitting(false);
      return;
    }

    try {
      await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        role: 'HOSPITAL_STAFF',
        hospitalProfile: {
          hospitalName: form.hospitalName,
          address: form.address,
          location: [form.city, form.region].filter(Boolean).join(', ') || form.address,
          city: form.city || undefined,
          region: form.region || undefined,
          latitude,
          longitude,
          bloodBankAvailable: true,
          contactName: form.inCharge,
          contactPhone: `${form.contactCode}${form.contactNumber}`,
        },
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

  const useBrowserLocation = () => {
    setError('');
    setMessage('');
    if (!navigator.geolocation) {
      setError('Browser geolocation is not available. Please pick the hospital location on the map.');
      return;
    }
    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((v) => ({
          ...v,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setMessage('Browser location captured. Confirm the pin is on the hospital before registering.');
        setCapturingLocation(false);
      },
      () => {
        setError('Could not capture browser location. Please pick the hospital location on the map.');
        setCapturingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 20000 },
    );
  };

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="legacy-panel mx-auto w-full space-y-4 rounded-2xl shadow-sm">
      <h1 className="flex items-center justify-center gap-2 text-center text-3xl font-bold text-primary sm:text-4xl">
        <AppIcon name="hospital" className="h-6 w-6" />
        Hospital Registration
      </h1>
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form className="space-y-3" onSubmit={submit} autoComplete="off">
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
        <div className="grid gap-2 sm:grid-cols-2">
          <input className="legacy-input" name="hospital_signup_city" autoComplete="off" placeholder="City" value={form.city} onChange={(e) => setForm((v) => ({ ...v, city: e.target.value }))} required />
          <input className="legacy-input" name="hospital_signup_region" autoComplete="off" placeholder="Region" value={form.region} onChange={(e) => setForm((v) => ({ ...v, region: e.target.value }))} required />
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-sm font-semibold text-slate-700">
            Latitude
            <input className="legacy-input mt-1" name="hospital_signup_lat" autoComplete="off" inputMode="decimal" placeholder="5.6698" value={form.latitude} readOnly />
          </label>
          <label className="text-sm font-semibold text-slate-700">
            Longitude
            <input className="legacy-input mt-1" name="hospital_signup_lng" autoComplete="off" inputMode="decimal" placeholder="-0.0166" value={form.longitude} readOnly />
          </label>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold text-slate-700">Select hospital location on the map</p>
          <p className="text-xs text-slate-500">
            These location details are required for emergency requests, nearest blood source search, donor matching, and live map coordination.
          </p>
          <button
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-primary transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={capturingLocation}
            type="button"
            onClick={useBrowserLocation}
          >
            {capturingLocation ? 'Capturing location...' : 'Use Browser Location'}
          </button>
          <p className="text-xs text-slate-500">Click the hospital location on the map or drag the pin to set coordinates.</p>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <HospitalLocationPicker
              latitude={form.latitude.trim() ? Number(form.latitude) : null}
              longitude={form.longitude.trim() ? Number(form.longitude) : null}
              onChange={(nextLat, nextLng) =>
                setForm((v) => ({ ...v, latitude: String(nextLat), longitude: String(nextLng) }))
              }
              className="h-64 w-full"
            />
          </div>
        </div>
        <p className="text-xs text-slate-500">
          Latitude and longitude help this hospital appear correctly on the Smart Blood Bank Map.
        </p>
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
      <div className="flex flex-wrap justify-center gap-4 text-sm">
        <Link className="text-primary underline" to="/hospital-login">
          Back to hospital login
        </Link>
        <Link className="text-primary underline" to="/">
          Back to home
        </Link>
      </div>
      </div>
    </section>
  );
}
