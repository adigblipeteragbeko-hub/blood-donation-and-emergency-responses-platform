import { FormEvent, useEffect, useMemo, useState } from 'react';
import { getDonorLiveLocation, updateDonorLiveLocation } from '../services/live-map';

export default function DonorLiveLocationPage() {
  const [status, setStatus] = useState('Location sharing is controlled by you. Public users never see donor locations.');
  const [loading, setLoading] = useState(false);
  const [sharingEnabled, setSharingEnabled] = useState(false);
  const [accuracyMeters, setAccuracyMeters] = useState<number | undefined>(undefined);
  const [form, setForm] = useState({
    latitude: '',
    longitude: '',
  });

  const hasCoordinates = useMemo(() => Boolean(form.latitude.trim() && form.longitude.trim()), [form.latitude, form.longitude]);

  useEffect(() => {
    let mounted = true;

    const loadSavedLocation = async () => {
      setLoading(true);
      try {
        const payload = await getDonorLiveLocation();
        if (!mounted) return;

        const donor = payload.donor;
        const savedLatitude = typeof donor.latitude === 'number' ? String(donor.latitude) : '';
        const savedLongitude = typeof donor.longitude === 'number' ? String(donor.longitude) : '';
        setForm({ latitude: savedLatitude, longitude: savedLongitude });
        setSharingEnabled(Boolean(donor.locationSharingEnabled));

        if (donor.locationSharingEnabled && savedLatitude && savedLongitude) {
          setStatus('Location saved and enabled for authorized emergency coordination.');
        } else if (donor.locationSharingEnabled) {
          setStatus('Location sharing is enabled, but no coordinates are saved yet. Please capture your browser location.');
        } else if (savedLatitude && savedLongitude) {
          setStatus('Coordinates are saved, but location sharing is disabled.');
        } else {
          setStatus('Location sharing is controlled by you. Public users never see donor locations.');
        }
      } catch (error: any) {
        if (!mounted) return;
        setStatus(error?.response?.data?.error?.message ?? 'Could not load saved location settings.');
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadSavedLocation();

    return () => {
      mounted = false;
    };
  }, []);

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Browser location is not supported on this device.');
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
        setAccuracyMeters(Math.round(position.coords.accuracy));
        setSharingEnabled(true);
        setStatus('Coordinates captured. Click Save Location Settings to make them available to authorized hospital staff.');
        setLoading(false);
      },
      () => {
        setStatus('Location permission was denied. Please allow location access in your browser settings and try again.');
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

      if (sharingEnabled && (latitude === undefined || longitude === undefined)) {
        setStatus('Please capture your browser location before saving.');
        return;
      }

      const payload = await updateDonorLiveLocation({
        latitude,
        longitude,
        locationSharingEnabled: sharingEnabled,
        accuracyMeters,
        source: latitude !== undefined && longitude !== undefined ? 'donor_portal' : 'location_sharing_settings',
      });
      const donor = payload.donor;
      setForm({
        latitude: typeof donor.latitude === 'number' ? String(donor.latitude) : '',
        longitude: typeof donor.longitude === 'number' ? String(donor.longitude) : '',
      });
      setSharingEnabled(Boolean(donor.locationSharingEnabled));
      setStatus(
        donor.locationSharingEnabled
          ? 'Location saved successfully for authorized emergency coordination.'
          : 'Location sharing is disabled. Your coordinates are hidden from operations maps.',
      );
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
          Control whether your captured coordinates can be used privately for emergency donor coordination.
        </p>
      </div>

      <form className="card space-y-5" onSubmit={saveSettings}>
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-primary">
          {status}
        </div>

        <label className="flex items-center justify-between gap-4 rounded-2xl border border-slate-200 p-4">
          <span>
            <span className="block text-sm font-bold text-primary">Enable secure location sharing</span>
            <span className="block text-xs text-muted">Only authorized admins and hospital staff can use this for emergency coordination.</span>
          </span>
          <input
            className="h-5 w-5 accent-red-600"
            type="checkbox"
            checked={sharingEnabled}
            onChange={(event) => setSharingEnabled(event.target.checked)}
          />
        </label>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">Current Location Status</p>
          <p className="mt-1 text-sm text-primary">
            {hasCoordinates
              ? sharingEnabled
                ? 'Coordinates saved or captured for secure emergency coordination.'
                : 'Coordinates captured, but sharing is currently disabled.'
              : 'Location not captured yet.'}
          </p>
          <p className="mt-2 text-xs text-muted">
            Area, community, city, and residential address are managed in the Health Eligibility Form.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <label className="space-y-2">
            <span className="text-sm font-semibold text-primary">Latitude</span>
            <input className="legacy-input bg-slate-50" readOnly placeholder="Captured automatically" value={form.latitude} />
          </label>
          <label className="space-y-2">
            <span className="text-sm font-semibold text-primary">Longitude</span>
            <input className="legacy-input bg-slate-50" readOnly placeholder="Captured automatically" value={form.longitude} />
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
