import { FormEvent, useEffect, useState } from 'react';
import api from '../services/api';
import { bloodGroups } from '../constants/blood-groups';
import { countryCodes } from '../constants/country-codes';

type DonorProfileForm = {
  fullName: string;
  bloodGroup: string;
  location: string;
  emergencyContactName: string;
  emergencyContactCode: string;
  emergencyContactNumber: string;
  eligibilityStatus: boolean;
  availabilityStatus: boolean;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
};

const emptyProfile: DonorProfileForm = {
  fullName: '',
  bloodGroup: '',
  location: '',
  emergencyContactName: '',
  emergencyContactCode: '+233',
  emergencyContactNumber: '',
  eligibilityStatus: true,
  availabilityStatus: true,
  notificationEmailEnabled: true,
  notificationSmsEnabled: false,
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<DonorProfileForm>(emptyProfile);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await api.get('/donors/profile');
        const data = response.data?.data;
        const parsedPhone = `${data?.emergencyContactPhone ?? ''}`.match(/^(\+\d{1,4})(\d+)$/);

        setProfile({
          fullName: data?.fullName ?? '',
          bloodGroup: data?.bloodGroup ?? '',
          location: data?.location ?? '',
          emergencyContactName: data?.emergencyContactName ?? '',
          emergencyContactCode: parsedPhone?.[1] ?? '+233',
          emergencyContactNumber: parsedPhone?.[2] ?? '',
          eligibilityStatus: data?.eligibilityStatus ?? true,
          availabilityStatus: data?.availabilityStatus ?? true,
          notificationEmailEnabled: data?.notificationEmailEnabled ?? true,
          notificationSmsEnabled: data?.notificationSmsEnabled ?? false,
        });
      } catch {
        setProfile(emptyProfile);
      } finally {
        setLoading(false);
      }
    };

    void loadProfile();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError('');
    setSaving(true);

    try {
      await api.post('/donors/profile', {
        fullName: profile.fullName,
        bloodGroup: profile.bloodGroup,
        location: profile.location,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: `${profile.emergencyContactCode}${profile.emergencyContactNumber}`,
        eligibilityStatus: profile.eligibilityStatus,
        availabilityStatus: profile.availabilityStatus,
        notificationEmailEnabled: profile.notificationEmailEnabled,
        notificationSmsEnabled: profile.notificationSmsEnabled,
      });
      setSaved(true);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not save profile.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">My Profile</h1>
      <p className="text-sm text-gray-600">Personal info, blood group, contact details, and location.</p>
      {loading ? <p className="text-sm text-gray-600">Loading profile...</p> : null}
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Profile saved.</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <form className="grid gap-3 sm:grid-cols-2" onSubmit={submit} autoComplete="off">
        <label className="text-sm font-semibold">
          Full Name
          <input
            className="legacy-input mt-1"
            value={profile.fullName}
            onChange={(e) => setProfile((v) => ({ ...v, fullName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
            pattern="[A-Za-z\s'-]+"
            title="Name should contain letters only"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          Blood Group
          <select className="legacy-input mt-1" value={profile.bloodGroup} onChange={(e) => setProfile((v) => ({ ...v, bloodGroup: e.target.value }))} required>
            <option value="">Select Blood Group</option>
            {bloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Contact Number
          <div className="mt-1 grid grid-cols-[1fr_2fr] gap-2">
            <select
              className="legacy-input"
              value={profile.emergencyContactCode}
              onChange={(e) => setProfile((v) => ({ ...v, emergencyContactCode: e.target.value }))}
            >
              {countryCodes.map((code) => (
                <option key={code.value} value={code.value}>
                  {code.label}
                </option>
              ))}
            </select>
            <input
              className="legacy-input"
              value={profile.emergencyContactNumber}
              onChange={(e) => setProfile((v) => ({ ...v, emergencyContactNumber: e.target.value.replace(/\D/g, '') }))}
              pattern="\d+"
              inputMode="numeric"
              title="Contact number should contain numbers only"
              required
            />
          </div>
        </label>
        <label className="text-sm font-semibold">
          Emergency Contact Name
          <input
            className="legacy-input mt-1"
            value={profile.emergencyContactName}
            onChange={(e) => setProfile((v) => ({ ...v, emergencyContactName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
            pattern="[A-Za-z\s'-]+"
            title="Name should contain letters only"
            required
          />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Location
          <input className="legacy-input mt-1" value={profile.location} onChange={(e) => setProfile((v) => ({ ...v, location: e.target.value }))} required />
        </label>

        <label className="flex items-center gap-2 text-sm sm:col-span-2">
          <input checked={profile.availabilityStatus} onChange={(e) => setProfile((v) => ({ ...v, availabilityStatus: e.target.checked }))} type="checkbox" />
          Available for donation
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input checked={profile.notificationEmailEnabled} onChange={(e) => setProfile((v) => ({ ...v, notificationEmailEnabled: e.target.checked }))} type="checkbox" />
          Email Notifications
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input checked={profile.notificationSmsEnabled} onChange={(e) => setProfile((v) => ({ ...v, notificationSmsEnabled: e.target.checked }))} type="checkbox" />
          SMS Notifications
        </label>

        <button className="btn-primary sm:col-span-2 disabled:cursor-not-allowed disabled:opacity-70" disabled={saving || loading} type="submit">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </section>
  );
}
