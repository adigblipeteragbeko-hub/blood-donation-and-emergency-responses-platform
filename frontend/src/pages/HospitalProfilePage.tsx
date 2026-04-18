import { FormEvent, useEffect, useState } from 'react';
import { getHospitalProfile, upsertHospitalProfile } from '../services/hospital-portal';

const initialForm = {
  hospitalName: '',
  registrationCode: '',
  address: '',
  location: '',
  contactName: '',
  contactPhone: '',
};

export default function HospitalProfilePage() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getHospitalProfile();
        setForm({
          hospitalName: profile.hospitalName ?? '',
          registrationCode: profile.registrationCode ?? '',
          address: profile.address ?? '',
          location: profile.location ?? '',
          contactName: profile.contactName ?? '',
          contactPhone: profile.contactPhone ?? '',
        });
      } catch {
        // keep blank if profile is unavailable
      }
    };
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await upsertHospitalProfile(form);
      setMessage('Hospital profile updated.');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Profile / Hospital Info</h1>
        <p className="text-sm text-muted">Update hospital details, contact info, and location.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Hospital Name
          <input
            className="legacy-input mt-1"
            required
            type="text"
            value={form.hospitalName}
            onChange={(e) => setForm((prev) => ({ ...prev, hospitalName: e.target.value }))}
          />
        </label>
        <label className="text-sm font-semibold">
          Registration Code
          <input
            className="legacy-input mt-1"
            required
            type="text"
            value={form.registrationCode}
            onChange={(e) => setForm((prev) => ({ ...prev, registrationCode: e.target.value }))}
          />
        </label>
        <label className="text-sm font-semibold">
          Contact Name
          <input
            className="legacy-input mt-1"
            required
            type="text"
            value={form.contactName}
            onChange={(e) => setForm((prev) => ({ ...prev, contactName: e.target.value }))}
          />
        </label>
        <label className="text-sm font-semibold">
          Contact Number (+countrycode)
          <input
            className="legacy-input mt-1"
            placeholder="+233..."
            required
            type="tel"
            value={form.contactPhone}
            onChange={(e) => setForm((prev) => ({ ...prev, contactPhone: e.target.value }))}
          />
        </label>
        <label className="text-sm font-semibold">
          City / Location
          <input
            className="legacy-input mt-1"
            required
            type="text"
            value={form.location}
            onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
          />
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Address
          <textarea
            className="legacy-input mt-1 min-h-24"
            required
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" disabled={saving} type="submit">
          {saving ? 'Saving...' : 'Update Hospital Profile'}
        </button>
        {message ? <p className="text-sm text-primary md:col-span-2">{message}</p> : null}
      </form>
    </section>
  );
}

