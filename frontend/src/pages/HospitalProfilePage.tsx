import { FormEvent, useEffect, useState } from 'react';
import { getHospitalProfile, updateHospitalLogo, upsertHospitalProfile } from '../services/hospital-portal';
import { HospitalLocationPicker } from '../components/ui/HospitalLocationPicker';
import { SmartAvatar } from '../components/SmartAvatar';

const initialForm = {
  hospitalName: '',
  registrationCode: '',
  address: '',
  location: '',
  city: '',
  region: '',
  latitude: '',
  longitude: '',
  contactName: '',
  contactPhone: '',
};

export default function HospitalProfilePage() {
  const [form, setForm] = useState(initialForm);
  const [message, setMessage] = useState('');
  const [logoUrl, setLogoUrl] = useState<string | null>(null);
  const [logoMessage, setLogoMessage] = useState('');
  const [logoSaving, setLogoSaving] = useState(false);
  const [saving, setSaving] = useState(false);
  const [capturingLocation, setCapturingLocation] = useState(false);
  const [mapStatus, setMapStatus] = useState<'Map Ready' | 'Coordinates Missing' | 'Geocoding Failed' | 'Pending Approval'>('Pending Approval');

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getHospitalProfile();
        setForm({
          hospitalName: profile.hospitalName ?? '',
          registrationCode: profile.registrationCode ?? '',
          address: profile.address ?? '',
          location: profile.location ?? '',
          city: profile.city ?? '',
          region: profile.region ?? '',
          latitude: typeof profile.latitude === 'number' ? String(profile.latitude) : '',
          longitude: typeof profile.longitude === 'number' ? String(profile.longitude) : '',
          contactName: profile.contactName ?? '',
          contactPhone: profile.contactPhone ?? '',
        });
        setLogoUrl(profile.logoUrl ?? null);
        const approved = profile.isApproved ?? false;
        const hasCoordinates = typeof profile.latitude === 'number' && typeof profile.longitude === 'number';
        if (!approved) {
          setMapStatus('Pending Approval');
        } else if (!hasCoordinates) {
          setMapStatus('Coordinates Missing');
        } else {
          setMapStatus('Map Ready');
        }
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
    const latitude = form.latitude.trim() ? Number(form.latitude) : undefined;
    const longitude = form.longitude.trim() ? Number(form.longitude) : undefined;
    if (!form.city.trim() || !form.region.trim()) {
      setMessage('City and region are required for emergency requests and live map coordination.');
      setSaving(false);
      return;
    }
    if (latitude === undefined || longitude === undefined) {
      setMessage('Please select the hospital location on the map.');
      setSaving(false);
      return;
    }
    if (latitude !== undefined && (Number.isNaN(latitude) || latitude < -90 || latitude > 90)) {
      setMessage('Latitude must be between -90 and 90.');
      setSaving(false);
      return;
    }
    if (longitude !== undefined && (Number.isNaN(longitude) || longitude < -180 || longitude > 180)) {
      setMessage('Longitude must be between -180 and 180.');
      setSaving(false);
      return;
    }
    try {
      await upsertHospitalProfile({
        hospitalName: form.hospitalName,
        registrationCode: form.registrationCode,
        address: form.address,
        location: form.location,
        city: form.city,
        region: form.region,
        latitude,
        longitude,
        contactName: form.contactName,
        contactPhone: form.contactPhone,
      });
      setMessage('Hospital profile updated.');
    } catch (error: any) {
      const nextMessage = error?.response?.data?.error?.message ?? 'Failed to save profile.';
      setMessage(nextMessage);
      if (String(nextMessage).toLowerCase().includes('unable to locate this hospital automatically')) {
        setMapStatus('Geocoding Failed');
      }
    } finally {
      setSaving(false);
    }
  };

  const useBrowserLocation = () => {
    setMessage('');
    if (!navigator.geolocation) {
      setMessage('Browser geolocation is not available. Please pick the hospital location on the map.');
      return;
    }
    setCapturingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((prev) => ({
          ...prev,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setMessage('Browser location captured. Confirm the pin is on the hospital before saving.');
        setCapturingLocation(false);
      },
      () => {
        setMessage('Could not capture browser location. Please pick the hospital location on the map.');
        setCapturingLocation(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 20000 },
    );
  };

  const saveLogo = async (nextLogoUrl: string) => {
    setLogoSaving(true);
    setLogoMessage('');
    try {
      const updated = await updateHospitalLogo(nextLogoUrl);
      setLogoUrl(updated.logoUrl ?? null);
      window.dispatchEvent(new CustomEvent('hospital-logo-updated', { detail: updated }));
      setLogoMessage(nextLogoUrl ? 'Hospital logo updated.' : 'Hospital logo removed.');
    } catch (error: any) {
      setLogoMessage(error?.response?.data?.message ?? 'Unable to update hospital logo.');
    } finally {
      setLogoSaving(false);
    }
  };

  const uploadLogo = (file?: File) => {
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setLogoMessage('Use a JPG, PNG, or WebP logo.');
      return;
    }
    if (file.size > 1_200_000) {
      setLogoMessage('Use a logo image smaller than 1.2 MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      void saveLogo(value);
    };
    reader.readAsDataURL(file);
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Profile / Hospital Info</h1>
        <p className="text-sm text-muted">Update hospital details, contact info, and location.</p>
        <p className="mt-2 text-sm font-semibold text-slate-600">
          These location details are required for emergency requests, nearest blood source search, donor matching, and live map coordination.
        </p>
        <div className="mt-3">
          <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
            mapStatus === 'Map Ready'
              ? 'bg-emerald-100 text-emerald-700'
              : mapStatus === 'Pending Approval'
                ? 'bg-slate-100 text-slate-700'
                : 'bg-amber-100 text-amber-700'
          }`}>
            Map Status: {mapStatus}
          </span>
        </div>
      </div>

      <form className="card grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <div className="rounded-2xl border border-slate-100 bg-white/70 p-4 md:col-span-2">
          <div className="flex flex-wrap items-center gap-4">
            <SmartAvatar name={form.hospitalName || 'Hospital'} src={logoUrl} size="lg" />
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-slate-500">Hospital Logo</p>
              <p className="mt-1 text-sm text-muted">Used for facility identity on the hospital dashboard, hospital profile, and account menu. This is separate from personal profile photos.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <label className="cursor-pointer rounded-xl border border-red-200 px-3 py-2 text-xs font-bold text-primary">
                  {logoSaving ? 'Saving...' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  <input
                    className="sr-only"
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    disabled={logoSaving}
                    onChange={(event) => uploadLogo(event.target.files?.[0])}
                  />
                </label>
                <button
                  className="cursor-pointer rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={logoSaving || !logoUrl}
                  type="button"
                  onClick={() => void saveLogo('')}
                >
                  Remove Logo
                </button>
              </div>
              <p className="mt-2 text-xs text-muted">Accepted: JPG, PNG, WebP. Maximum size: 1.2 MB.</p>
              {logoMessage ? <p className="mt-2 rounded-lg bg-slate-50 p-2 text-xs font-semibold text-slate-700">{logoMessage}</p> : null}
            </div>
          </div>
        </div>
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
        <label className="text-sm font-semibold">
          City *
          <input
            className="legacy-input mt-1"
            required
            type="text"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          />
        </label>
        <label className="text-sm font-semibold">
          Region *
          <input
            className="legacy-input mt-1"
            required
            type="text"
            value={form.region}
            onChange={(e) => setForm((prev) => ({ ...prev, region: e.target.value }))}
          />
        </label>
        <label className="text-sm font-semibold">
          Latitude
          <input
            className="legacy-input mt-1"
            placeholder="5.6698"
            inputMode="decimal"
            type="text"
            value={form.latitude}
            readOnly
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Latitude and longitude help this hospital appear correctly on the Smart Blood Bank Map.</span>
        </label>
        <label className="text-sm font-semibold">
          Longitude
          <input
            className="legacy-input mt-1"
            placeholder="-0.0166"
            inputMode="decimal"
            type="text"
            value={form.longitude}
            readOnly
          />
          <span className="mt-1 block text-xs font-normal text-slate-500">Latitude and longitude help this hospital appear correctly on the Smart Blood Bank Map.</span>
        </label>
        <div className="space-y-2 md:col-span-2">
          <p className="text-sm font-semibold text-slate-700">Select hospital location on the map</p>
          <p className="text-xs text-slate-500">Click the hospital location on the map or drag the pin to set coordinates.</p>
          <button
            className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-primary transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            disabled={capturingLocation}
            type="button"
            onClick={useBrowserLocation}
          >
            {capturingLocation ? 'Capturing location...' : 'Use Browser Location'}
          </button>
          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <HospitalLocationPicker
              latitude={form.latitude.trim() ? Number(form.latitude) : null}
              longitude={form.longitude.trim() ? Number(form.longitude) : null}
              onChange={(nextLat, nextLng) =>
                setForm((prev) => ({ ...prev, latitude: String(nextLat), longitude: String(nextLng) }))
              }
              className="h-72 w-full"
            />
          </div>
        </div>
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
