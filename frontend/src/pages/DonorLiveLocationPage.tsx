import { FormEvent, useState } from 'react';
import { updateDonorLiveLocation } from '../services/live-map';

export default function DonorLiveLocationPage() {
  const [status, setStatus] = useState('Location sharing is controlled by you. Public users never see donor locations.');
  const [loading, setLoading] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [form, setForm] = useState({
    areaCommunity: '',
    city: '',
    region: '',
    latitude: '',
    longitude: '',
  });

  const setField = (field: keyof typeof form, value: string) => {
    setForm((current) => ({ ...current, [field]: value }));
  };

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not available on this device. You can still enter your area manually.');
      return;
    }

    setLoading(true);
    setStatus('Requesting location permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setForm((current) => ({
          ...current,
          latitude: String(position.coords.latitude),
          longitude: String(position.coords.longitude),
        }));
        setSharingEnabled(true);
        setStatus(`Location captured. Accuracy about ${Math.round(position.coords.accuracy)}m. Press Save Settings to update securely.`);
        setLoading(false);
      },
      () => {
        setStatus('Location permission was denied or unavailable. You can still save your area, city, and region.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 },
    );
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setStatus('Saving secure donor location settings...');

    try {
      const latitude = form.latitude.trim() ? Number(form.latitude) : undefined;
      const longitude = form.longitude.trim() ? Number(form.longitude) : undefined;

      await updateDonorLiveLocation({
        latitude,
        longitude,
        areaCommunity: form.areaCommunity,
        city: form.city,
        region: form.region,
        locationSharingEnabled: sharingEnabled,
        source: latitude !== undefined && longitude !== undefined ? 'donor_portal' : 'manual_area_update',
      });
      setStatus(sharingEnabled ? 'Location sharing is enabled for authorized emergency coordination.' : 'Location sharing is disabled. Your coordinates are hidden from operations maps.');
    } catch (error: any) {
      setStatus(error?.response?.data?.error?.message ?? 'Could not update location settings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Privacy controlled</p>
        <h1 className="text-2xl font-bold text-primary">Donor Location Settings</h1>
        <p className="text-sm text-muted">
          Share your area and optional live coordinates so hospitals can find compatible donors faster during emergencies.
        </p>
      </div>

      <form className="card space-y-5" onSubmit={saveSettings}>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-primary">
          {status}
        </div>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
          <span>
            <span className="block text-sm font-bold text-primary">Enable secure location sharing</span>
            <span className="block text-xs text-muted">Only admins and authorized hospital staff can see donor coverage.</span>
          </span>
          <input
            className="h-5 w-5 accent-red-600"
            type="checkbox"
            checked={sharingEnabled}
            onChange={(event) => setSharingEnabled(event.target.checked)}
          />
        </label>

        <div className="grid gap-4 md:grid-cols-3">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-primary">Area / Community</span>
            <input className="legacy-input" placeholder="e.g. Ashaiman Lebanon" value={form.areaCommunity} onChange={(event) => setField('areaCommunity', event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-primary">City</span>
            <input className="legacy-input" placeholder="e.g. Tema" value={form.city} onChange={(event) => setField('city', event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-primary">Region</span>
            <input className="legacy-input" placeholder="e.g. Greater Accra" value={form.region} onChange={(event) => setField('region', event.target.value)} />
          </label>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-primary">Latitude</span>
            <input className="legacy-input" inputMode="decimal" placeholder="Captured automatically or entered manually" value={form.latitude} onChange={(event) => setField('latitude', event.target.value)} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-primary">Longitude</span>
            <input className="legacy-input" inputMode="decimal" placeholder="Captured automatically or entered manually" value={form.longitude} onChange={(event) => setField('longitude', event.target.value)} />
          </label>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <button className="btn-secondary" type="button" disabled={loading} onClick={shareLocation}>
            Use Browser Location
          </button>
          <button className="btn-primary" type="submit" disabled={loading}>
            {loading ? 'Saving...' : 'Save Location Settings'}
          </button>
        </div>

        <p className="text-xs text-muted">
          Privacy rule: public visitors can see hospitals and blood banks, but never donor markers, donor identities, phone numbers, or email addresses.
        </p>
      </form>
    </section>
  );
}
