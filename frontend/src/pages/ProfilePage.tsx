import { FormEvent, useEffect, useState } from 'react';
import api from '../services/api';
import { bloodGroups } from '../constants/blood-groups';
import { countryCodes } from '../constants/country-codes';

type DonorProfileForm = {
  fullName: string;
  firstName: string;
  otherNames: string;
  surname: string;
  phoneCode: string;
  phoneNumber: string;
  alternativePhoneCode: string;
  alternativePhoneNumber: string;
  dateOfBirth: string;
  bloodGroup: string;
  location: string;
  postalAddress: string;
  preferredHospitalId: string;
  passportPhotoUrl: string;
  emergencyContactName: string;
  emergencyContactCode: string;
  emergencyContactNumber: string;
  emergencyContactRelationship: string;
  eligibilityStatus: boolean;
  availabilityStatus: boolean;
  notificationEmailEnabled: boolean;
  notificationSmsEnabled: boolean;
};

type HospitalOption = {
  id: string;
  hospitalName: string;
  location?: string | null;
  city?: string | null;
  region?: string | null;
};

type EligibilityStatus = {
  reviewStatus?: string | null;
  healthFormCompleted?: boolean;
  healthFormSubmitted?: boolean;
  canSetAvailable?: boolean;
  blockedByRecentDonation?: boolean;
  reason?: string;
  lastDonationDate?: string | null;
  nextEligibilityDate?: string | null;
};

type DonorProfilePayload = {
  donorNumber?: string | null;
  bloodGroup?: string | null;
  eligibilityStatus?: boolean;
  availabilityStatus?: boolean;
  lastDonationDate?: string | null;
  nextEligibilityDate?: string | null;
  donationHistory?: Array<{ id: string; donatedAt: string }>;
};

const emptyProfile: DonorProfileForm = {
  fullName: '',
  firstName: '',
  otherNames: '',
  surname: '',
  phoneCode: '+233',
  phoneNumber: '',
  alternativePhoneCode: '+233',
  alternativePhoneNumber: '',
  dateOfBirth: '',
  bloodGroup: '',
  location: '',
  postalAddress: '',
  preferredHospitalId: '',
  passportPhotoUrl: '',
  emergencyContactName: '',
  emergencyContactCode: '+233',
  emergencyContactNumber: '',
  emergencyContactRelationship: '',
  eligibilityStatus: true,
  availabilityStatus: true,
  notificationEmailEnabled: true,
  notificationSmsEnabled: false,
};

export default function ProfilePage() {
  const relationshipOptions = ['Father', 'Mother', 'Brother', 'Sister', 'Spouse', 'Guardian', 'Friend', 'Relative', 'Other'];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [profile, setProfile] = useState<DonorProfileForm>(emptyProfile);
  const [profileData, setProfileData] = useState<DonorProfilePayload | null>(null);
  const [eligibilityStatus, setEligibilityStatus] = useState<EligibilityStatus | null>(null);
  const [hospitalOptions, setHospitalOptions] = useState<HospitalOption[]>([]);

  const formatStatus = (value?: string | null) => (value ? value.replace(/_/g, ' ') : 'Not started');
  const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleDateString() : 'Not Recorded');
  const bloodGroupLabel = (value?: string | null) => bloodGroups.find((group) => group.value === value)?.label ?? value ?? 'Not Recorded';

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const [profileResponse, hospitalsResponse, eligibilityResponse] = await Promise.allSettled([
          api.get('/donors/profile'),
          api.get('/donors/hospital-options'),
          api.get('/donors/eligibility/status'),
        ]);
        const data = profileResponse.status === 'fulfilled' ? profileResponse.value.data?.data ?? profileResponse.value.data : {};
        const hospitals = hospitalsResponse.status === 'fulfilled' ? hospitalsResponse.value.data?.data ?? hospitalsResponse.value.data : [];
        const eligibility = eligibilityResponse.status === 'fulfilled' ? eligibilityResponse.value.data?.data ?? eligibilityResponse.value.data : null;
        const parsedPhone = `${data?.emergencyContactPhone ?? ''}`.match(/^(\+\d{1,4})(\d+)$/);
        const parsedPrimaryPhone = `${data?.phone ?? ''}`.match(/^(\+\d{1,4})(\d+)$/);
        const parsedAlternativePhone = `${data?.alternativePhoneNumber ?? ''}`.match(/^(\+\d{1,4})(\d+)$/);
        const legacyNameParts = `${data?.fullName ?? ''}`.trim().split(/\s+/).filter(Boolean);

        setProfileData(data ?? null);
        setHospitalOptions(Array.isArray(hospitals) ? hospitals : []);
        setEligibilityStatus(eligibility ?? null);
        setProfile({
          fullName: data?.fullName ?? '',
          firstName: data?.firstName ?? legacyNameParts[1] ?? legacyNameParts[0] ?? '',
          otherNames: data?.otherNames ?? legacyNameParts.slice(2).join(' '),
          surname: data?.surname ?? (legacyNameParts.length > 1 ? legacyNameParts[0] : ''),
          phoneCode: parsedPrimaryPhone?.[1] ?? '+233',
          phoneNumber: parsedPrimaryPhone?.[2] ?? '',
          alternativePhoneCode: parsedAlternativePhone?.[1] ?? '+233',
          alternativePhoneNumber: parsedAlternativePhone?.[2] ?? '',
          dateOfBirth: data?.dateOfBirth ? `${data.dateOfBirth}`.slice(0, 10) : '',
          bloodGroup: data?.bloodGroup ?? '',
          location: data?.location ?? '',
          postalAddress: data?.postalAddress ?? '',
          preferredHospitalId: data?.preferredHospitalId ?? data?.preferredHospital?.id ?? '',
          passportPhotoUrl: data?.passportPhotoUrl ?? '',
          emergencyContactName: data?.emergencyContactName ?? '',
          emergencyContactCode: parsedPhone?.[1] ?? '+233',
          emergencyContactNumber: parsedPhone?.[2] ?? '',
          emergencyContactRelationship: data?.emergencyContactRelationship ?? '',
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
        firstName: profile.firstName,
        otherNames: profile.otherNames || undefined,
        surname: profile.surname,
        fullName: [profile.surname, profile.firstName, profile.otherNames].filter(Boolean).join(' ') || profile.fullName,
        phone: `${profile.phoneCode}${profile.phoneNumber}`,
        alternativePhoneNumber: profile.alternativePhoneNumber ? `${profile.alternativePhoneCode}${profile.alternativePhoneNumber}` : undefined,
        dateOfBirth: profile.dateOfBirth || undefined,
        bloodGroup: profile.bloodGroup,
        location: profile.location,
        postalAddress: profile.postalAddress,
        passportPhotoUrl: profile.passportPhotoUrl,
        preferredHospitalId: profile.preferredHospitalId || undefined,
        emergencyContactName: profile.emergencyContactName,
        emergencyContactPhone: `${profile.emergencyContactCode}${profile.emergencyContactNumber}`,
        emergencyContactRelationship: profile.emergencyContactRelationship,
        eligibilityStatus: profile.eligibilityStatus,
        availabilityStatus: profile.availabilityStatus,
        notificationEmailEnabled: profile.notificationEmailEnabled,
        notificationSmsEnabled: profile.notificationSmsEnabled,
      });
      const refreshed = await api.get('/donors/profile');
      setProfileData(refreshed.data?.data ?? refreshed.data ?? null);
      setSaved(true);
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Unable to save profile. Please check required fields.');
    } finally {
      setSaving(false);
    }
  };

  const uploadPassportPhoto = (file?: File) => {
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      setProfile((prev) => ({ ...prev, passportPhotoUrl: value }));
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">My Profile</h1>
      <p className="text-sm text-gray-600">Personal info, blood group, contact details, and location.</p>
      {loading ? <p className="text-sm text-gray-600">Loading profile...</p> : null}
      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Profile updated successfully.</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {profile.bloodGroup === 'UNKNOWN' ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">Blood Group Not Yet Confirmed. Hospital staff will confirm it during eligibility screening.</p> : null}

      <form className="space-y-5" onSubmit={submit} autoComplete="off">
        <div className="rounded-2xl border border-red-100 bg-red-50/40 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600">Donor Status Summary</p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-xl border border-white bg-white p-3">
              <p className="text-xs font-semibold text-muted">Donor ID</p>
              <p className="font-bold text-primary">{profileData?.donorNumber ?? 'Not Assigned'}</p>
            </div>
            <div className="rounded-xl border border-white bg-white p-3">
              <p className="text-xs font-semibold text-muted">Blood Group</p>
              <p className="font-bold text-primary">{bloodGroupLabel(profileData?.bloodGroup ?? profile.bloodGroup)}</p>
            </div>
            <div className="rounded-xl border border-white bg-white p-3">
              <p className="text-xs font-semibold text-muted">Clinical Status</p>
              <p className="font-bold text-primary">{formatStatus(eligibilityStatus?.reviewStatus)}</p>
            </div>
            <div className="rounded-xl border border-white bg-white p-3">
              <p className="text-xs font-semibold text-muted">Availability Status</p>
              <p className="font-bold text-primary">
                {eligibilityStatus?.blockedByRecentDonation ? 'Cooldown Active' : profileData?.availabilityStatus ? 'Available' : 'Not Available'}
              </p>
            </div>
            <div className="rounded-xl border border-white bg-white p-3">
              <p className="text-xs font-semibold text-muted">Total Donations</p>
              <p className="font-bold text-primary">{profileData?.donationHistory?.length ?? 0}</p>
            </div>
            <div className="rounded-xl border border-white bg-white p-3">
              <p className="text-xs font-semibold text-muted">Last Donation Date</p>
              <p className="font-bold text-primary">{formatDate(profileData?.lastDonationDate ?? eligibilityStatus?.lastDonationDate)}</p>
            </div>
            <div className="rounded-xl border border-white bg-white p-3">
              <p className="text-xs font-semibold text-muted">Next Eligible Date</p>
              <p className="font-bold text-primary">{formatDate(profileData?.nextEligibilityDate ?? eligibilityStatus?.nextEligibilityDate).replace('Not Recorded', 'Not Available')}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4 sm:grid-cols-3">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 sm:col-span-3">Personal Information</p>
        <label className="text-sm font-semibold">
          First Name *
          <input
            className="legacy-input mt-1"
            value={profile.firstName}
            onChange={(e) => setProfile((v) => ({ ...v, firstName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
            pattern="[A-Za-z\s'-]+"
            title="First name should contain letters only"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          Other Name(s)
          <input
            className="legacy-input mt-1"
            value={profile.otherNames}
            onChange={(e) => setProfile((v) => ({ ...v, otherNames: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
            pattern="[A-Za-z\s'-]+"
          />
        </label>
        <label className="text-sm font-semibold">
          Surname *
          <input
            className="legacy-input mt-1"
            value={profile.surname}
            onChange={(e) => setProfile((v) => ({ ...v, surname: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
            pattern="[A-Za-z\s'-]+"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          Date of Birth
          <input className="legacy-input mt-1" type="date" value={profile.dateOfBirth} onChange={(e) => setProfile((v) => ({ ...v, dateOfBirth: e.target.value }))} />
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
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4 sm:grid-cols-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 sm:col-span-2">Contact Information</p>
        <label className="text-sm font-semibold">
          Primary Phone Number *
          <div className="mt-1 grid grid-cols-[1fr_2fr] gap-2">
            <select
              className="legacy-input"
              value={profile.phoneCode}
              onChange={(e) => setProfile((v) => ({ ...v, phoneCode: e.target.value }))}
            >
              {countryCodes.map((code) => (
                <option key={code.value} value={code.value}>
                  {code.label}
                </option>
              ))}
            </select>
            <input
              className="legacy-input"
              value={profile.phoneNumber}
              onChange={(e) => setProfile((v) => ({ ...v, phoneNumber: e.target.value.replace(/\D/g, '') }))}
              pattern="\d+"
              inputMode="numeric"
              required
            />
          </div>
        </label>
        <label className="text-sm font-semibold">
          Alternative Phone Number (Optional)
          <div className="mt-1 grid grid-cols-[1fr_2fr] gap-2">
            <select
              className="legacy-input"
              value={profile.alternativePhoneCode}
              onChange={(e) => setProfile((v) => ({ ...v, alternativePhoneCode: e.target.value }))}
            >
              {countryCodes.map((code) => (
                <option key={code.value} value={code.value}>
                  {code.label}
                </option>
              ))}
            </select>
            <input
              className="legacy-input"
              value={profile.alternativePhoneNumber}
              onChange={(e) => setProfile((v) => ({ ...v, alternativePhoneNumber: e.target.value.replace(/\D/g, '') }))}
              pattern="\d*"
              inputMode="numeric"
            />
          </div>
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Location
          <input className="legacy-input mt-1" value={profile.location} onChange={(e) => setProfile((v) => ({ ...v, location: e.target.value }))} required />
        </label>
        <label className="text-sm font-semibold sm:col-span-2">
          Physical / Postal Address
          <input className="legacy-input mt-1" value={profile.postalAddress} onChange={(e) => setProfile((v) => ({ ...v, postalAddress: e.target.value }))} />
        </label>
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Preferred Donation Center</p>
          <label className="text-sm font-semibold">
            Preferred Hospital / Blood Bank
            <select
              className="legacy-input mt-1"
              value={profile.preferredHospitalId}
              onChange={(e) => setProfile((v) => ({ ...v, preferredHospitalId: e.target.value }))}
            >
              <option value="">Select preferred center</option>
              {hospitalOptions.map((hospital) => (
                <option key={hospital.id} value={hospital.id}>
                  {hospital.hospitalName}{hospital.location ? ` - ${hospital.location}` : ''}
                </option>
              ))}
            </select>
          </label>
          <p className="text-xs text-muted">
            This center helps hospitals coordinate donor screening, appointments, and routine donation follow-up.
          </p>
        </div>
        <div className="grid gap-3 rounded-2xl border border-red-100 bg-red-50/40 p-4 sm:grid-cols-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-red-600 sm:col-span-2">Emergency Contact</p>
        <label className="text-sm font-semibold">
          Emergency Contact Name *
          <input
            className="legacy-input mt-1"
            value={profile.emergencyContactName}
            onChange={(e) => setProfile((v) => ({ ...v, emergencyContactName: e.target.value.replace(/[^A-Za-z\s'-]/g, '') }))}
            pattern="[A-Za-z\s'-]+"
            required
          />
        </label>
        <label className="text-sm font-semibold">
          Emergency Contact Phone Number *
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
        <label className="text-sm font-semibold sm:col-span-2">
          Relationship to Donor *
          <select className="legacy-input mt-1" value={profile.emergencyContactRelationship} onChange={(e) => setProfile((v) => ({ ...v, emergencyContactRelationship: e.target.value }))} required>
            <option value="">Select relationship</option>
            {relationshipOptions.map((relationship) => (
              <option key={relationship} value={relationship}>{relationship}</option>
            ))}
          </select>
        </label>
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4 sm:grid-cols-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 sm:col-span-2">Identification</p>
        <label className="text-sm font-semibold sm:col-span-2">
          Upload Passport Photo
          <input
            className="legacy-input mt-1"
            type="file"
            accept="image/*"
            onChange={(e) => uploadPassportPhoto(e.target.files?.[0])}
          />
          <span className="mt-1 block text-xs text-muted">
            Upload from this device. You can also leave it empty and attach a printed passport photo manually after downloading/printing the card.
          </span>
        </label>
        <div className="sm:col-span-2 rounded border border-amber-200 bg-amber-50 p-2 text-sm text-amber-700">
          Availability is managed from the Availability Status tab after health form submission and admin approval.
        </div>
        </div>
        <div className="grid gap-3 rounded-2xl border border-slate-100 bg-white/70 p-4 sm:grid-cols-2">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500 sm:col-span-2">Preferences</p>
        <label className="flex items-center gap-2 text-sm">
          <input checked={profile.notificationEmailEnabled} onChange={(e) => setProfile((v) => ({ ...v, notificationEmailEnabled: e.target.checked }))} type="checkbox" />
          Email Notifications
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input checked={profile.notificationSmsEnabled} onChange={(e) => setProfile((v) => ({ ...v, notificationSmsEnabled: e.target.checked }))} type="checkbox" />
          SMS Notifications
        </label>
        </div>

        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70" disabled={saving || loading} type="submit">
          {saving ? 'Saving...' : 'Save Profile'}
        </button>
      </form>
    </section>
  );
}
