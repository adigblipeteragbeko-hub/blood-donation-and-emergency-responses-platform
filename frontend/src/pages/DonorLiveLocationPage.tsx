import { useState } from 'react';
import { updateDonorLiveLocation } from '../services/live-map';

export default function DonorLiveLocationPage() {
  const [status, setStatus] = useState('Your live location is shared only when you press the button below.');
  const [loading, setLoading] = useState(false);

  const shareLocation = () => {
    if (!navigator.geolocation) {
      setStatus('Geolocation is not available on this device.');
      return;
    }

    setLoading(true);
    setStatus('Requesting location permission...');
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await updateDonorLiveLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracyMeters: position.coords.accuracy,
            source: 'donor_portal',
          });
          setStatus(`Location updated. Accuracy about ${Math.round(position.coords.accuracy)}m.`);
        } catch (error: any) {
          setStatus(error?.response?.data?.error?.message ?? 'Could not update location.');
        } finally {
          setLoading(false);
        }
      },
      () => {
        setStatus('Location permission was denied or unavailable.');
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Privacy controlled</p>
        <h1 className="text-2xl font-bold text-primary">Live Location Sharing</h1>
        <p className="text-sm text-muted">Share your current location when you are available for emergency donation matching.</p>
      </div>

      <div className="card space-y-4">
        <p className="text-sm text-muted">{status}</p>
        <button className="btn-primary" type="button" disabled={loading} onClick={shareLocation}>
          {loading ? 'Updating Location...' : 'Share My Current Location'}
        </button>
        <p className="text-xs text-muted">
          Authorized admins and hospital staff can view live donor locations only for emergency coordination. Every update is audit logged.
        </p>
      </div>
    </section>
  );
}
