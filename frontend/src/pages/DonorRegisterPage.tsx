import { FormEvent, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { bloodGroups } from '../constants/blood-groups';
import { countryCodes } from '../constants/country-codes';
import { AppIcon } from '../components/ui/AppIcon';

export default function DonorRegisterPage() {
  const navigate = useNavigate();
  const relationshipOptions = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Guardian', 'Friend', 'Relative', 'Other'];
  const emptyForm = {
    firstName: '',
    otherNames: '',
    surname: '',
    email: '',
    bloodGroup: '',
    countryCode: '+233',
    phoneNumber: '',
    alternativeCountryCode: '+233',
    alternativePhoneNumber: '',
    emergencyContactName: '',
    emergencyContactCode: '+233',
    emergencyContactPhone: '',
    emergencyContactRelationship: '',
    password: '',
    verificationMethod: 'EMAIL' as 'EMAIL' | 'SMS',
  };
  const [form, setForm] = useState({
    ...emptyForm,
  });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    setSubmitting(true);

    try {
      if (form.verificationMethod === 'SMS' && !/^\+?2330?[235]\d{8}$|^0?[235]\d{8}$/.test(`${form.countryCode}${form.phoneNumber}`.replace(/\s/g, ''))) {
        throw new Error('Enter a valid Ghana phone number before choosing SMS verification.');
      }
      const response = await api.post('/auth/register', {
        email: form.email,
        password: form.password,
        role: 'DONOR',
        verificationMethod: form.verificationMethod,
        donorProfile: {
          firstName: form.firstName,
          otherNames: form.otherNames || undefined,
          surname: form.surname,
          fullName: [form.surname, form.firstName, form.otherNames].filter(Boolean).join(' '),
          phone: `${form.countryCode}${form.phoneNumber}`,
          alternativePhoneNumber: form.alternativePhoneNumber ? `${form.alternativeCountryCode}${form.alternativePhoneNumber}` : undefined,
          bloodGroup: form.bloodGroup,
          emergencyContactName: form.emergencyContactName,
          emergencyContactPhone: `${form.emergencyContactCode}${form.emergencyContactPhone}`,
          emergencyContactRelationship: form.emergencyContactRelationship,
        },
      });
      const method = response.data?.data?.verificationMethod ?? form.verificationMethod;
      const maskedDestination = response.data?.data?.maskedDestination;
      setMessage(`Donor registered successfully. Verification code sent by ${method === 'SMS' ? 'SMS' : 'Email'}${maskedDestination ? ` to ${maskedDestination}` : ''}.`);
      setForm({ ...emptyForm });
      setTimeout(() => navigate('/verify-email', {
        state: {
          email: form.email,
          role: 'donor',
          verificationMethod: method,
          maskedDestination,
          expiresInMinutes: response.data?.data?.expiresInMinutes ?? 5,
        },
      }), 700);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? err?.message ?? 'Unable to register donor. Please check required fields and try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const maskedEmail = form.email.includes('@') ? `${form.email.slice(0, 1)}***@${form.email.split('@')[1]}` : 'your email address';
  const fullPhone = `${form.countryCode}${form.phoneNumber}`;
  const maskedPhone = form.phoneNumber ? `${'*'.repeat(Math.max(0, fullPhone.length - 4))}${fullPhone.slice(-4)}` : 'your phone number';

  return (
    <section className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
      <div className="legacy-panel mx-auto w-full space-y-4 rounded-2xl shadow-sm">
      <h1 className="flex items-center justify-center gap-2 text-center text-3xl font-bold text-primary sm:text-4xl">
        <AppIcon name="heart" className="h-6 w-6" />
        Donor Registration
      </h1>
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      <form className="space-y-5" onSubmit={submit} autoComplete="off">
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white/70 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Personal Information</p>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              className="legacy-input"
              name="donor_signup_first_name"
              autoComplete="off"
              placeholder="First Name *"
              value={form.firstName}
              onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
              pattern="[A-Za-z\s'-]+"
              title="First name should contain letters only"
              required
            />
            <input
              className="legacy-input"
              name="donor_signup_other_names"
              autoComplete="off"
              placeholder="Other Name(s)"
              value={form.otherNames}
              onChange={(e) => setForm((v) => ({ ...v, otherNames: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
              pattern="[A-Za-z\s'-]+"
              title="Other names should contain letters only"
            />
            <input
              className="legacy-input"
              name="donor_signup_surname"
              autoComplete="off"
              placeholder="Surname *"
              value={form.surname}
              onChange={(e) => setForm((v) => ({ ...v, surname: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
              pattern="[A-Za-z\s'-]+"
              title="Surname should contain letters only"
              required
            />
          </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-slate-100 bg-white/70 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Contact Information</p>
        <input className="legacy-input" name="donor_signup_email" autoComplete="off" placeholder="Email Address" type="email" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} required />
        <select className="legacy-input" name="donor_signup_blood_group" value={form.bloodGroup} onChange={(e) => setForm((v) => ({ ...v, bloodGroup: e.target.value }))} required>
          <option value="">Select Blood Group</option>
          {bloodGroups.map((group) => (
            <option key={group.value} value={group.value}>
              {group.label}
            </option>
          ))}
        </select>
        <p className="text-xs font-semibold text-slate-500">Primary Phone Number is used for alerts, calls, SMS, and appointment reminders.</p>
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
            placeholder="Primary Phone Number *"
            value={form.phoneNumber}
            onChange={(e) => setForm((v) => ({ ...v, phoneNumber: e.target.value.replace(/\D/g, '') }))}
            pattern="\d+"
            inputMode="numeric"
            title="Phone number should contain numbers only"
            required
          />
        </div>
        <fieldset className="space-y-3 rounded-2xl border border-slate-100 bg-white/70 p-4">
          <legend className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Verification Code</legend>
          <p className="text-sm font-semibold text-slate-700">How would you like to receive your verification code?</p>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`cursor-pointer rounded-xl border p-3 text-sm ${form.verificationMethod === 'EMAIL' ? 'border-primary bg-red-50 text-primary' : 'border-slate-200 bg-white text-slate-700'}`}>
              <input className="mr-2" type="radio" name="verificationMethod" checked={form.verificationMethod === 'EMAIL'} onChange={() => setForm((v) => ({ ...v, verificationMethod: 'EMAIL' }))} />
              Email
              <span className="mt-1 block text-xs text-slate-500">{maskedEmail}</span>
            </label>
            <label className={`cursor-pointer rounded-xl border p-3 text-sm ${form.verificationMethod === 'SMS' ? 'border-primary bg-red-50 text-primary' : 'border-slate-200 bg-white text-slate-700'}`}>
              <input className="mr-2" type="radio" name="verificationMethod" checked={form.verificationMethod === 'SMS'} onChange={() => setForm((v) => ({ ...v, verificationMethod: 'SMS' }))} />
              SMS
              <span className="mt-1 block text-xs text-slate-500">{maskedPhone}</span>
            </label>
          </div>
          <p className="text-xs text-slate-500">Your verification code expires in 5 minutes.</p>
        </fieldset>
        <div className="grid grid-cols-[1fr_2fr] gap-2">
          <select className="legacy-input" value={form.alternativeCountryCode} onChange={(e) => setForm((v) => ({ ...v, alternativeCountryCode: e.target.value }))}>
            {countryCodes.map((code) => (
              <option key={code.value} value={code.value}>
                {code.label}
              </option>
            ))}
          </select>
          <input
            className="legacy-input"
            name="donor_signup_alt_phone"
            autoComplete="off"
            placeholder="Alternative Phone Number (Optional)"
            value={form.alternativePhoneNumber}
            onChange={(e) => setForm((v) => ({ ...v, alternativePhoneNumber: e.target.value.replace(/\D/g, '') }))}
            pattern="\d*"
            inputMode="numeric"
            title="Alternative phone number should contain numbers only"
          />
        </div>
        </div>
        <div className="space-y-3 rounded-2xl border border-red-100 bg-red-50/40 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Emergency Contact</p>
          <input
            className="legacy-input"
            placeholder="Emergency Contact Name *"
            value={form.emergencyContactName}
            onChange={(e) => setForm((v) => ({ ...v, emergencyContactName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
            required
          />
          <div className="grid grid-cols-[1fr_2fr] gap-2">
            <select className="legacy-input" value={form.emergencyContactCode} onChange={(e) => setForm((v) => ({ ...v, emergencyContactCode: e.target.value }))}>
              {countryCodes.map((code) => (
                <option key={code.value} value={code.value}>
                  {code.label}
                </option>
              ))}
            </select>
            <input
              className="legacy-input"
              placeholder="Emergency Contact Phone Number *"
              value={form.emergencyContactPhone}
              onChange={(e) => setForm((v) => ({ ...v, emergencyContactPhone: e.target.value.replace(/\D/g, '') }))}
              pattern="\d+"
              inputMode="numeric"
              required
            />
          </div>
          <select className="legacy-input" value={form.emergencyContactRelationship} onChange={(e) => setForm((v) => ({ ...v, emergencyContactRelationship: e.target.value }))} required>
            <option value="">Relationship to Donor *</option>
            {relationshipOptions.map((relationship) => (
              <option key={relationship} value={relationship}>{relationship}</option>
            ))}
          </select>
        </div>
        <input className="legacy-input" name="donor_signup_password" autoComplete="new-password" placeholder="Password" type="password" value={form.password} onChange={(e) => setForm((v) => ({ ...v, password: e.target.value }))} required />
        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70" disabled={submitting} type="submit">
          {submitting ? 'Registering...' : 'Register Donor'}
        </button>
      </form>
      <div className="flex flex-wrap justify-center gap-4 text-sm">
        <Link className="text-primary underline" to="/donor-login">
          Back to donor login
        </Link>
        <Link className="text-primary underline" to="/">
          Back to home
        </Link>
      </div>
      </div>
    </section>
  );
}
