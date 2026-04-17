import { FormEvent, useState } from 'react';

const emptyProfile = {
  fullName: '',
  bloodType: '',
  phone: '',
  email: '',
  location: '',
};

export default function ProfilePage() {
  const [saved, setSaved] = useState(false);
  const [profile, setProfile] = useState(emptyProfile);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    setSaved(true);
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">My Profile</h1>
      <p className="text-sm text-gray-600">Personal info, blood type, contact details, and location.</p>
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Profile saved.</p> : null}
      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit} autoComplete="off">
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
