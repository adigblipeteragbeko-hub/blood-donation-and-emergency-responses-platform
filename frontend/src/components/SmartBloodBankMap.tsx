import { useCallback, useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import { io } from 'socket.io-client';
import {
  BloodGroup,
  getSmartBloodBanks,
  SmartBloodBankCenter,
  SmartBloodBankMapResponse,
  SmartEmergencyRequest,
} from '../services/smart-blood-banks';
import { ENGLISH_FRIENDLY_TILE_ATTRIBUTION, ENGLISH_FRIENDLY_TILE_URL } from '../constants/map-tiles';

const GHANA_CENTER: [number, number] = [7.9465, -1.0232];
const BLOOD_GROUPS: { value: BloodGroup | ''; label: string }[] = [
  { value: '', label: 'All blood' },
  { value: 'O_POS', label: 'O+' },
  { value: 'O_NEG', label: 'O-' },
  { value: 'A_POS', label: 'A+' },
  { value: 'A_NEG', label: 'A-' },
  { value: 'B_POS', label: 'B+' },
  { value: 'B_NEG', label: 'B-' },
  { value: 'AB_POS', label: 'AB+' },
  { value: 'AB_NEG', label: 'AB-' },
];
const RADIUS_OPTIONS = [5, 10, 20, 50];
const realtimeBaseUrl = () => import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000';

const markerIcon = (label: string, tone: 'navy' | 'red' | 'amber' | 'blue') =>
  L.divIcon({
    className: 'smart-blood-marker-wrap',
    html: `<div class="smart-blood-marker smart-blood-marker-${tone}">${label}</div>`,
    iconSize: [42, 42],
    iconAnchor: [21, 21],
    popupAnchor: [0, -20],
  });

const centerIcon = (center: SmartBloodBankCenter) => {
  if (center.emergencyLevel === 'critical') return markerIcon('!', 'red');
  if (center.emergencyLevel === 'urgent' || center.criticalStockCount > 0) return markerIcon('B', 'amber');
  return markerIcon(center.centerType === 'blood_bank' ? 'B' : 'H', 'navy');
};

const requestIcon = markerIcon('ER', 'red');
const userIcon = markerIcon('YOU', 'blue');

function RecenterMap({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();

  useEffect(() => {
    map.flyTo(center, zoom, { duration: 0.7 });
  }, [center, map, zoom]);

  return null;
}

const statusStyles: Record<string, string> = {
  stable: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  low: 'border-amber-200 bg-amber-50 text-amber-700',
  critical: 'border-red-200 bg-red-50 text-red-700',
  unpublished: 'border-slate-200 bg-slate-50 text-slate-500',
};

const levelStyles: Record<string, string> = {
  normal: 'bg-slate-100 text-slate-700',
  watch: 'bg-amber-50 text-amber-700',
  urgent: 'bg-orange-50 text-orange-700',
  critical: 'bg-red-50 text-red-700',
};

const formatCenterType = (value: string) => value.replace('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const formatDate = (value: string | null) => {
  if (!value) return 'Inventory not published yet';
  return new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
};

function CenterPopup({ center }: { center: SmartBloodBankCenter }) {
  const available = center.bloodAvailability.filter((item) => item.availableUnits > 0);

  return (
    <div className="w-72 space-y-3 text-sm text-slate-700">
      <div>
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">{formatCenterType(center.centerType)}</p>
        <h3 className="mt-1 text-base font-black text-slate-950">{center.name}</h3>
        <p className="mt-1 text-xs text-slate-500">{center.city} • {center.region}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={`rounded-full px-2 py-1 text-[11px] font-bold uppercase ${levelStyles[center.emergencyLevel]}`}>
          {center.emergencyLevel}
        </span>
        <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-600">
          {center.distanceKm !== null ? `${center.distanceKm} km away` : 'distance unavailable'}
        </span>
      </div>
      <p className="leading-6">{center.description ?? 'Emergency-ready partner center.'}</p>
      <div className="grid grid-cols-4 gap-1">
        {(available.length ? available : center.bloodAvailability.slice(0, 4)).map((item) => (
          <span key={item.bloodGroup} className={`rounded-lg border px-2 py-1 text-center text-xs font-black ${statusStyles[item.status]}`}>
            {item.label}<br />{item.status === 'unpublished' ? '--' : item.availableUnits}
          </span>
        ))}
      </div>
      <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-600">
        <p><strong>Contact:</strong> {center.contactPhone}</p>
        <p><strong>Address:</strong> {center.address}</p>
        <p><strong>Last update:</strong> {formatDate(center.lastUpdated)}</p>
      </div>
    </div>
  );
}

function RequestPopup({ request }: { request: SmartEmergencyRequest }) {
  return (
    <div className="w-72 space-y-2 text-sm text-slate-700">
      <p className="text-xs font-black uppercase tracking-[0.18em] text-red-700">Emergency Request</p>
      <h3 className="text-base font-black text-slate-950">{request.bloodGroupLabel} needed</h3>
      <p>{request.unitsNeeded} unit(s) at {request.hospitalCenterName ?? request.hospitalName}</p>
      <p className="text-xs text-slate-500">
        {request.emergencyLocation ?? request.location}
        {request.ward ? ` • ${request.ward}` : ''}
        {request.city || request.region ? ` • ${[request.city, request.region].filter(Boolean).join(', ')}` : ''}
      </p>
      <p className="text-xs text-slate-500">
        Need by {new Date(request.requiredBy).toLocaleString()}
        {request.distanceKm !== null ? ` • ${request.distanceKm} km away` : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <span className="inline-flex rounded-full bg-red-50 px-2 py-1 text-[11px] font-bold uppercase text-red-700">
          {request.priority}
        </span>
        <span className="inline-flex rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-700">
          {request.status}/{request.trackingStatus}
        </span>
      </div>
      {request.locationNotes || request.notes ? (
        <p className="rounded-lg bg-slate-50 px-2 py-1 text-xs text-slate-600">
          {request.locationNotes ?? request.notes}
        </p>
      ) : null}
      <div className="rounded-lg border border-red-100 p-2 text-xs">
        <p className="font-bold text-slate-800">Nearby coordination</p>
        <p>5km: {request.nearby.radius5km.compatibleDonors} donors • {request.nearby.radius5km.hospitalsWithStock} hospitals</p>
        <p>10km: {request.nearby.radius10km.compatibleDonors} donors • {request.nearby.radius10km.hospitalsWithStock} hospitals</p>
        <p>20km: {request.nearby.radius20km.compatibleDonors} donors • {request.nearby.radius20km.hospitalsWithStock} hospitals</p>
      </div>
    </div>
  );
}

export function SmartBloodBankMap() {
  const [data, setData] = useState<SmartBloodBankMapResponse | null>(null);
  const [search, setSearch] = useState('');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>('');
  const [radiusKm, setRadiusKm] = useState(20);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const [locationMessage, setLocationMessage] = useState('');

  const loadCenters = useCallback(async () => {
    setLoading(true);
    try {
      const payload = await getSmartBloodBanks({
        search,
        bloodGroup,
        radiusKm,
        emergencyMode,
        latitude: userLocation?.latitude,
        longitude: userLocation?.longitude,
      });
      setData(payload);
      setSelectedCenterId((current) => current ?? payload.summary.nearestMatchingSource?.id ?? payload.centers[0]?.id ?? null);
      setError('');
    } catch {
      setError('We could not load the smart blood bank map right now. Please check the backend and try again.');
    } finally {
      setLoading(false);
    }
  }, [bloodGroup, emergencyMode, radiusKm, search, userLocation?.latitude, userLocation?.longitude]);

  useEffect(() => {
    void loadCenters();
  }, [loadCenters]);

  useEffect(() => {
    const socket = io(`${realtimeBaseUrl()}/realtime`, {
      transports: ['websocket', 'polling'],
      withCredentials: true,
    });

    const refreshMapData = () => {
      void loadCenters();
    };

    socket.on('inventory.updated', refreshMapData);
    socket.on('emergency.request.updated', refreshMapData);
    socket.on('emergency.request.public.updated', refreshMapData);

    const interval = window.setInterval(refreshMapData, 45000);

    return () => {
      window.clearInterval(interval);
      socket.off('inventory.updated', refreshMapData);
      socket.off('emergency.request.updated', refreshMapData);
      socket.off('emergency.request.public.updated', refreshMapData);
      socket.disconnect();
    };
  }, [loadCenters]);

  const selectedCenter = useMemo(
    () => data?.centers.find((center) => center.id === selectedCenterId) ?? data?.summary.nearestMatchingSource ?? data?.centers[0] ?? null,
    [data?.centers, data?.summary.nearestMatchingSource, selectedCenterId],
  );

  const mapCenter: [number, number] = selectedCenter
    ? [selectedCenter.latitude, selectedCenter.longitude]
    : userLocation
      ? [userLocation.latitude, userLocation.longitude]
      : GHANA_CENTER;

  const requestLocation = () => {
    if (!navigator.geolocation) {
      setLocationMessage('Location is not supported in this browser. You can still search manually.');
      return;
    }

    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setUserLocation({ latitude: position.coords.latitude, longitude: position.coords.longitude });
        setLocationMessage('Location detected. Results now show distance from you.');
        setLocating(false);
      },
      () => {
        setLocationMessage('Location permission was denied. Showing Ghana-wide centers instead.');
        setLocating(false);
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  };

  return (
    <section className="max-w-full space-y-6 overflow-x-hidden">
      <div className="rounded-[2rem] border border-red-100 bg-white p-4 shadow-xl shadow-slate-950/5 sm:p-5 md:p-7">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-3xl">
            <p className="text-xs font-black uppercase tracking-[0.28em] text-red-700">Smart blood bank locator</p>
            <h1 className="mt-3 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl md:text-5xl">
              Find the nearest safe blood source fast
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
              Search Ghana hospitals, blood banks, live inventory, urgent shortages, and emergency request locations from one operational map.
            </p>
          </div>
          <button className="btn-primary" disabled={locating} onClick={requestLocation} type="button">
            {locating ? 'Detecting...' : 'Use My Location'}
          </button>
        </div>

        {locationMessage ? <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-600">{locationMessage}</p> : null}

        <div className="mt-6 grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-[1.4fr_0.8fr_0.8fr_auto]">
          <input
            className="legacy-input"
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search hospital, blood bank, city, region, or contact"
            value={search}
          />
          <select className="legacy-input" onChange={(event) => setBloodGroup(event.target.value as BloodGroup | '')} value={bloodGroup}>
            {BLOOD_GROUPS.map((group) => (
              <option key={group.label} value={group.value}>{group.label}</option>
            ))}
          </select>
          <select className="legacy-input" onChange={(event) => setRadiusKm(Number(event.target.value))} value={radiusKm}>
            {RADIUS_OPTIONS.map((radius) => (
              <option key={radius} value={radius}>Within {radius} km</option>
            ))}
          </select>
          <button
            className={`rounded-2xl border px-4 py-3 text-sm font-black transition ${
              emergencyMode ? 'border-primary bg-primary text-white' : 'border-red-100 bg-white text-primary hover:bg-red-50'
            }`}
            onClick={() => setEmergencyMode((current) => !current)}
            type="button"
          >
            Emergency mode
          </button>
        </div>
      </div>

      {error ? (
        <article className="rounded-[1.5rem] border border-red-200 bg-red-50 px-5 py-4 text-sm font-semibold text-red-700">
          {error}
        </article>
      ) : null}

      <div className="grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ['Centers Found', data?.summary.totalCenters ?? 0],
          ['Units Available', data?.summary.totalUnitsAvailable ?? 0],
          ['Critical Centers', data?.summary.criticalStockCenters ?? 0],
          ['Active Emergencies', data?.summary.activeEmergencyRequests ?? 0],
        ].map(([label, value]) => (
          <article key={label} className="min-w-0 rounded-[1.5rem] border border-red-100 bg-white p-4 shadow-sm sm:p-5">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">{label}</p>
            <p className="mt-2 text-2xl font-black text-primary sm:text-3xl">{value}</p>
          </article>
        ))}
      </div>

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.75fr)]">
        <div className="overflow-hidden rounded-[2rem] border border-red-100 bg-white shadow-xl shadow-slate-950/5">
          {loading ? (
            <div className="flex h-[420px] items-center justify-center text-sm font-bold text-slate-500 sm:h-[500px] xl:h-[560px]">Loading smart blood bank map...</div>
          ) : data?.centers.length ? (
            <MapContainer center={mapCenter} className="h-[420px] w-full sm:h-[500px] xl:h-[560px]" scrollWheelZoom zoom={selectedCenter ? 13 : 7}>
              <RecenterMap center={mapCenter} zoom={selectedCenter ? 13 : 7} />
              <TileLayer
                attribution={ENGLISH_FRIENDLY_TILE_ATTRIBUTION}
                url={ENGLISH_FRIENDLY_TILE_URL}
              />
              {userLocation ? (
                <Marker icon={userIcon} position={[userLocation.latitude, userLocation.longitude]}>
                  <Popup>Your current location</Popup>
                </Marker>
              ) : null}
              {data.centers.map((center) => (
                <Marker
                  eventHandlers={{ click: () => setSelectedCenterId(center.id) }}
                  icon={centerIcon(center)}
                  key={center.id}
                  position={[center.latitude, center.longitude]}
                >
                  <Popup><CenterPopup center={center} /></Popup>
                </Marker>
              ))}
              {data.emergencyRequests.map((request) => (
                <Marker icon={requestIcon} key={request.id} position={[request.latitude, request.longitude]}>
                  <Popup><RequestPopup request={request} /></Popup>
                </Marker>
              ))}
            </MapContainer>
          ) : (
            <div className="flex h-[420px] items-center justify-center p-6 text-center sm:h-[500px] xl:h-[560px]">
              <div>
                <h2 className="text-2xl font-black text-slate-900">No centers match your filters</h2>
                <p className="mt-2 text-sm leading-7 text-slate-600">Try increasing the radius, clearing the blood group filter, or searching another city.</p>
              </div>
            </div>
          )}
        </div>

        <aside className="space-y-4">
          <article className="rounded-[2rem] border border-red-100 bg-red-50 p-5">
            <p className="text-xs font-black uppercase tracking-[0.22em] text-red-700">Nearest source</p>
            <h2 className="mt-2 text-xl font-black text-slate-950">{data?.summary.nearestMatchingSource?.name ?? 'No matching source yet'}</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              {data?.summary.nearestMatchingSource?.distanceKm !== null && data?.summary.nearestMatchingSource?.distanceKm !== undefined
                ? `${data.summary.nearestMatchingSource.distanceKm} km from your location.`
                : 'Enable location and choose a blood group to calculate the nearest available source.'}
            </p>
          </article>

          <div className="rounded-[2rem] border border-red-100 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-lg font-black text-slate-950">Blood center directory</h2>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-600">Live inventory</span>
            </div>
            <div className="max-h-[470px] space-y-3 overflow-y-auto pr-1">
              {loading ? Array.from({ length: 4 }).map((_, index) => <div className="skeleton-line h-24 rounded-3xl" key={index} />) : null}
              {!loading && data?.centers.map((center) => (
                <button
                  className={`w-full rounded-[1.35rem] border p-4 text-left transition hover:-translate-y-0.5 hover:border-red-200 hover:shadow-md ${
                    selectedCenter?.id === center.id ? 'border-primary bg-red-50' : 'border-slate-200 bg-white'
                  }`}
                  key={center.id}
                  onClick={() => setSelectedCenterId(center.id)}
                  type="button"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.16em] text-red-700">{formatCenterType(center.centerType)}</p>
                      <h3 className="mt-1 font-black text-slate-950">{center.name}</h3>
                      <p className="mt-1 text-xs text-slate-500">{center.city} • {center.region}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-[11px] font-black uppercase ${levelStyles[center.emergencyLevel]}`}>
                      {center.emergencyLevel}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {center.bloodAvailability.slice(0, 8).map((item) => (
                      <span key={item.bloodGroup} className={`rounded-full border px-2 py-1 text-xs font-bold ${statusStyles[item.status]}`}>
                        {item.label}: {item.status === 'unpublished' ? '--' : item.availableUnits}
                      </span>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-semibold text-slate-500">
                    <span>{center.distanceKm !== null ? `${center.distanceKm} km away` : center.contactPhone}</span>
                    <span>{center.totalUnits ? `${center.totalUnits} units` : 'Inventory pending'}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <article className="rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm lg:col-span-2">
          <h2 className="text-xl font-black text-slate-950">Emergency response queue</h2>
          <div className="mt-4 space-y-3">
            {!loading && data?.emergencyRequests.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-red-100 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                No active emergency requests match this map view.
              </p>
            ) : null}
            {data?.emergencyRequests.map((request) => (
              <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-red-100 bg-red-50/50 p-4">
                <div>
                  <p className="text-sm font-black text-slate-950">{request.bloodGroupLabel} • {request.unitsNeeded} unit(s)</p>
                  <p className="mt-1 text-xs font-semibold text-slate-500">
                    {request.hospitalCenterName ?? request.hospitalName} • {request.emergencyLocation ?? request.location}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {request.ward ? `${request.ward} • ` : ''}{[request.city, request.region].filter(Boolean).join(', ')}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="rounded-full bg-primary px-3 py-1 text-xs font-black uppercase text-white">{request.priority}</span>
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold uppercase text-slate-700">{request.status}/{request.trackingStatus}</span>
                </div>
              </div>
            ))}
          </div>
        </article>

        <article className="rounded-[1.75rem] border border-red-100 bg-white p-5 shadow-sm">
          <h2 className="text-xl font-black text-slate-950">Legend</h2>
          <div className="mt-4 grid gap-3 text-sm font-semibold text-slate-600">
            <p><span className="mr-2 inline-block h-3 w-3 rounded-full bg-slate-900" /> Hospital / blood center</p>
            <p><span className="mr-2 inline-block h-3 w-3 rounded-full bg-red-600" /> Critical emergency</p>
            <p><span className="mr-2 inline-block h-3 w-3 rounded-full bg-amber-500" /> Low stock / urgent watch</p>
            <p><span className="mr-2 inline-block h-3 w-3 rounded-full bg-blue-600" /> Your location</p>
          </div>
        </article>
      </div>
    </section>
  );
}
