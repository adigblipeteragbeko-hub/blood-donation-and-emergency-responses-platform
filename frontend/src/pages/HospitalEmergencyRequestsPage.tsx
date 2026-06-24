import { FormEvent, useState } from 'react';
import { MapContainer, Marker, TileLayer, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { confirmedBloodGroups } from '../constants/blood-groups';
import { ENGLISH_FRIENDLY_TILE_ATTRIBUTION, ENGLISH_FRIENDLY_TILE_URL } from '../constants/map-tiles';
import { AsyncTypeahead, TypeaheadSuggestion } from '../components/ui/AsyncTypeahead';
import { BloodGroup, RequestSource, createHospitalRequest, getTypeaheadSuggestions } from '../services/hospital-portal';
import { AppIcon } from '../components/ui/AppIcon';

const GHANA_CENTER: [number, number] = [7.9465, -1.0232];
const markerIcon = L.divIcon({
  className: 'live-map-marker',
  html: '<span style="background:#dc0d28">ER</span>',
  iconSize: [34, 34],
  iconAnchor: [17, 17],
});

function defaultRequiredBy() {
  const date = new Date();
  date.setHours(date.getHours() + 2);
  return date.toISOString().slice(0, 16);
}

function MapPicker({
  position,
  onPick,
}: {
  position: [number, number] | null;
  onPick: (latitude: number, longitude: number) => void;
}) {
  useMapEvents({
    click(event) {
      onPick(event.latlng.lat, event.latlng.lng);
    },
  });

  return position ? <Marker icon={markerIcon} position={position} /> : null;
}

export default function HospitalEmergencyRequestsPage() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POS');
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [hospitalCenterName, setHospitalCenterName] = useState('');
  const [ward, setWard] = useState('');
  const [location, setLocation] = useState('');
  const [emergencyLocation, setEmergencyLocation] = useState('');
  const [city, setCity] = useState('');
  const [region, setRegion] = useState('');
  const [locationNotes, setLocationNotes] = useState('');
  const [requestSource, setRequestSource] = useState<RequestSource>('DONORS_AND_HOSPITALS');
  const [radiusKm, setRadiusKm] = useState<5 | 10 | 20>(10);
  const [requiredBy, setRequiredBy] = useState(defaultRequiredBy());
  const [notes, setNotes] = useState('');
  const [latitude, setLatitude] = useState<number | null>(null);
  const [longitude, setLongitude] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const mapPosition = latitude !== null && longitude !== null ? ([latitude, longitude] as [number, number]) : null;

  const useBrowserLocation = () => {
    if (!navigator.geolocation) {
      setMessage('Browser geolocation is not available.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude);
        setLongitude(position.coords.longitude);
        setMessage('Location captured from browser.');
      },
      () => setMessage('Could not capture browser location. You can pick on map manually.'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 20000 },
    );
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!hospitalCenterName.trim() || !ward.trim() || !location.trim() || !city.trim() || !region.trim()) {
      setMessage('Hospital/center, ward, location, city, and region are required.');
      return;
    }
    if (latitude === null || longitude === null) {
      setMessage('Please select emergency coordinates on the map or via browser location.');
      return;
    }
    setSubmitting(true);
    setMessage('');
    try {
      const request = await createHospitalRequest({
        hospitalCenterName,
        ward,
        bloodGroup,
        unitsNeeded,
        type: 'EMERGENCY',
        priority: 'CRITICAL',
        location,
        emergencyLocation: emergencyLocation || location,
        city,
        region,
        locationNotes,
        requestSource,
        latitude,
        longitude,
        radiusKm,
        requiredBy: new Date(requiredBy).toISOString(),
        notes,
      });
      setMessage(`Emergency request broadcasted. Request Reference: ${request.requestReference}`);
      setUnitsNeeded(1);
      setRequiredBy(defaultRequiredBy());
      setNotes('');
      setLocationNotes('');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to broadcast emergency request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-5 px-4 pt-1 sm:px-6">
      <div className="card">
        <h1 className="flex items-center gap-2 text-2xl font-bold text-primary">
          <AppIcon name="alert" className="h-5 w-5 text-red-600" />
          Emergency Request
        </h1>
        <p className="text-sm text-muted">Broadcast urgent, location-aware requests.</p>
      </div>

      <form className="card mx-auto grid w-full max-w-4xl gap-3 rounded-2xl shadow-sm md:grid-cols-2" onSubmit={submit}>
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm font-semibold text-slate-700 md:col-span-2">
          Request Reference: Will be generated automatically
        </div>
        <AsyncTypeahead
          label="Hospital / Center Name"
          value={hospitalCenterName}
          onChange={setHospitalCenterName}
          placeholder="Tema General Hospital"
          minLength={1}
          inputClassName="legacy-input mt-1"
          loadSuggestions={async (query): Promise<TypeaheadSuggestion[]> => {
            const payload = await getTypeaheadSuggestions(query);
            return payload.hospitals.map((item) => ({
              id: item.id,
              label: item.hospitalName,
              description: item.location,
              category: 'Hospital',
              value: item.hospitalName,
            }));
          }}
        />
        <label className="text-sm font-semibold">
          Ward / Department
          <input className="legacy-input mt-1" required value={ward} onChange={(e) => setWard(e.target.value)} />
        </label>

        <label className="text-sm font-semibold">
          Emergency Blood Group
          <select className="legacy-input mt-1" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}>
            {confirmedBloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Units Needed
          <input className="legacy-input mt-1" min={1} required type="number" value={unitsNeeded} onChange={(e) => setUnitsNeeded(Number(e.target.value))} />
        </label>

        <AsyncTypeahead
          label="Emergency Location Description"
          value={emergencyLocation}
          onChange={setEmergencyLocation}
          placeholder="Emergency Ward / Block / Unit"
          minLength={1}
          inputClassName="legacy-input mt-1"
          loadSuggestions={async (query): Promise<TypeaheadSuggestion[]> => {
            const payload = await getTypeaheadSuggestions(query);
            return payload.locations.map((item, index) => ({ id: `loc-${index}`, label: item, category: 'Location', value: item }));
          }}
        />
        <AsyncTypeahead
          label="Location"
          value={location}
          onChange={setLocation}
          placeholder="City area / street / district"
          minLength={1}
          inputClassName="legacy-input mt-1"
          loadSuggestions={async (query): Promise<TypeaheadSuggestion[]> => {
            const payload = await getTypeaheadSuggestions(query);
            return payload.locations.map((item, index) => ({ id: `full-${index}`, label: item, category: 'Location', value: item }));
          }}
        />

        <label className="text-sm font-semibold">
          City
          <input className="legacy-input mt-1" required value={city} onChange={(e) => setCity(e.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          Region
          <input className="legacy-input mt-1" required value={region} onChange={(e) => setRegion(e.target.value)} />
        </label>

        <label className="text-sm font-semibold">
          Required By
          <input className="legacy-input mt-1" required type="datetime-local" value={requiredBy} onChange={(e) => setRequiredBy(e.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          Donor Match Radius
          <select
            className="legacy-input mt-1"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value) as 5 | 10 | 20)}
          >
            <option value={5}>5 km</option>
            <option value={10}>10 km</option>
            <option value={20}>20 km</option>
          </select>
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Request Source
          <select className="legacy-input mt-1" value={requestSource} onChange={(e) => setRequestSource(e.target.value as RequestSource)}>
            <option value="DONORS_ONLY">Donors Only</option>
            <option value="HOSPITALS_ONLY">Hospitals Only</option>
            <option value="DONORS_AND_HOSPITALS">Donors + Hospitals</option>
          </select>
          <p className="mt-1 text-xs text-slate-500">
            Donors Only: notify approved compatible donors. Hospitals Only: search registered hospitals/blood-banks with stock. Donors + Hospitals: notify both for fastest response.
          </p>
        </label>
        <label className="text-sm font-semibold">
          Location Notes
          <input className="legacy-input mt-1" value={locationNotes} onChange={(e) => setLocationNotes(e.target.value)} />
        </label>

        <label className="text-sm font-semibold">
          Latitude
          <input className="legacy-input mt-1" readOnly value={latitude ?? ''} placeholder="Pick on map or use browser location" />
        </label>
        <label className="text-sm font-semibold">
          Longitude
          <input className="legacy-input mt-1" readOnly value={longitude ?? ''} placeholder="Pick on map or use browser location" />
        </label>

        <label className="text-sm font-semibold md:col-span-2">
          Emergency Notes
          <textarea className="legacy-input mt-1 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>

        <div className="md:col-span-2 space-y-2">
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={useBrowserLocation} type="button">Use Browser Location</button>
            <p className="text-xs text-slate-500">Tip: Click directly on the map to set emergency coordinates.</p>
          </div>
          <div className="overflow-hidden rounded-2xl border border-red-100">
            <MapContainer center={mapPosition ?? GHANA_CENTER} className="h-64 w-full" zoom={mapPosition ? 13 : 7} scrollWheelZoom>
              <TileLayer attribution={ENGLISH_FRIENDLY_TILE_ATTRIBUTION} url={ENGLISH_FRIENDLY_TILE_URL} />
              <MapPicker
                position={mapPosition}
                onPick={(nextLat, nextLng) => {
                  setLatitude(Number(nextLat.toFixed(6)));
                  setLongitude(Number(nextLng.toFixed(6)));
                }}
              />
            </MapContainer>
          </div>
        </div>

        <button className="btn-primary md:col-span-2 md:w-fit" disabled={submitting} type="submit">
          {submitting ? 'Broadcasting...' : 'Broadcast Emergency Alert'}
        </button>
        {message ? <p className="text-sm text-primary md:col-span-2">{message}</p> : null}
      </form>
    </section>
  );
}
