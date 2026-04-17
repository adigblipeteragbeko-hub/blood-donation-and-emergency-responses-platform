import { FormEvent, useState } from 'react';

export default function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState({
    fullName: 'Peter Agbeko',
    bloodType: 'O_POS (O+)',
    phone: '+233 24 000 0000',
    email: 'adigblipeteragbeko@gmail.com',
    location: 'Accra Central',
  });

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">My Profile</h1>
      <p className="text-sm text-gray-600">Personal info, blood type, contact details, and location.</p>
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Profile updated successfully.</p> : null}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Full Name
          <input className="legacy-input mt-1" value={profile.fullName} onChange={(e) => setProfile((v) => ({ ...v, fullName: e.target.value }))} />
        </label>
        <label className="text-sm font-semibold">
          Blood Type
          <input className="legacy-input mt-1" value={profile.bloodType} onChange={(e) => setProfile((v) => ({ ...v, bloodType: e.target.value }))} />
        </label>
        <label className="text-sm font-semibold">
          Phone
          <input className="legacy-input mt-1" value={profile.phone} onChange={(e) => setProfile((v) => ({ ...v, phone: e.target.value }))} />
        </label>
        <label className="text-sm font-semibold">
          Email
          <input className="legacy-input mt-1" type="email" value={profile.email} onChange={(e) => setProfile((v) => ({ ...v, email: e.target.value }))} />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Location
          <input className="legacy-input mt-1" value={profile.location} onChange={(e) => setProfile((v) => ({ ...v, location: e.target.value }))} />
        </label>
        <button className="btn-primary sm:col-span-2" type="submit">
          Save Profile
        </button>
      </form>
    </section>
  );
}
