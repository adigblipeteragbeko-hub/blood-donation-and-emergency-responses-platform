import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { bloodGroups } from '../constants/blood-groups';
import { BloodGroup } from '../services/hospital-portal';
import {
  createRealtimeSocket,
  findNearbyDonors,
  getDonorCoverage,
  getOperationsMap,
} from '../services/live-map';
import type { DonorCoveragePayload, MapBloodRequest, MapDonor, MapHospital } from '../services/live-map';
import { ENGLISH_FRIENDLY_TILE_ATTRIBUTION, ENGLISH_FRIENDLY_TILE_URL } from '../constants/map-tiles';

const ghanaCenter: [number, number] = [7.9465, -1.0232];

const makeIcon = (label: string, color: string) =>
  L.divIcon({
    className: 'live-map-marker',
    html: `<span style="background:${color}">${label}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const hospitalIcon = makeIcon('H', '#0f172a');
const donorIcon = makeIcon('D', '#dc0d28');
const requestIcon = makeIcon('!', '#f97316');

function formatBloodGroup(value: string) {
  return bloodGroups.find((group) => group.value === value)?.label ?? value;
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom(), { animate: true });
  }, [center, map]);
  return null;
}

export function LiveOperationsMap({ mode = 'operations' }: { mode?: 'operations' | 'search' }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hospitals, setHospitals] = useState<MapHospital[]>([]);
  const [requests, setRequests] = useState<MapBloodRequest[]>([]);
  const [donors, setDonors] = useState<MapDonor[]>([]);
  const [coverage, setCoverage] = useState<DonorCoveragePayload | null>(null);
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_NEG');
  const [radiusKm, setRadiusKm] = useState(25);
  const [userPosition, setUserPosition] = useState<[number, number] | null>(null);
  const [geoMessage, setGeoMessage] = useState('');

  const loadMap = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await getOperationsMap();
      setHospitals(payload.hospitals);
      setRequests(payload.requests);
      setDonors(payload.donors);
      void getDonorCoverage().then(setCoverage).catch(() => setCoverage(null));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Unable to load live map data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMap();
  }, []);

  useEffect(() => {
    const socket = createRealtimeSocket();
    socket.on('donor.location.updated', (payload: { donorId: string; latitude: number; longitude: number; updatedAt: string }) => {
      setDonors((current) =>
        current.map((donor) =>
          donor.id === payload.donorId
            ? { ...donor, latitude: payload.latitude, longitude: payload.longitude, updatedAt: payload.updatedAt }
            : donor,
        ),
      );
    });
    socket.on('donor.response.updated', () => void loadMap());
    socket.on('emergency.request.updated', () => void loadMap());
    socket.on('emergency.request.public.updated', () => void loadMap());
    return () => {
      socket.disconnect();
    };
  }, []);

  const center = useMemo<[number, number]>(() => {
    const firstHospital = hospitals.find((item) => item.latitude !== null && item.longitude !== null);
    const firstRequest = requests.find((item) => item.latitude !== null && item.longitude !== null);
    const firstDonor = donors.find((item) => item.latitude !== null && item.longitude !== null);
    const point = firstRequest ?? firstHospital ?? firstDonor;
    return point?.latitude !== null && point?.longitude !== null && point?.latitude !== undefined && point?.longitude !== undefined
      ? [point.latitude, point.longitude]
      : ghanaCenter;
  }, [donors, hospitals, requests]);

  const locateBrowser = () => {
    if (!navigator.geolocation) {
      setGeoMessage('Browser geolocation is not available on this device.');
      return;
    }
    setGeoMessage('Requesting location permission...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const nextPosition: [number, number] = [position.coords.latitude, position.coords.longitude];
        setUserPosition(nextPosition);
        setGeoMessage(`Location permission granted. Accuracy about ${Math.round(position.coords.accuracy)}m.`);
      },
      () => setGeoMessage('Location permission was denied or unavailable.'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  const searchNearby = async () => {
    if (!userPosition) {
      setGeoMessage('Use My Location first, then search nearby donors.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const nearby = await findNearbyDonors({
        bloodGroup,
        latitude: userPosition[0],
        longitude: userPosition[1],
        radiusKm,
      });
      setDonors(nearby);
      setGeoMessage(`Found ${nearby.length} eligible donor(s) within ${radiusKm}km.`);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Nearby donor search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="max-w-full space-y-4 overflow-x-hidden">
      <div className="card flex min-w-0 max-w-full flex-col justify-between gap-4 lg:flex-row lg:items-end">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-red-600">Secure live tracking</p>
          <h1 className="break-words text-2xl font-bold text-primary">Emergency Donor Map</h1>
          <p className="text-sm text-muted">
            Donor live locations are visible only to authorized admins and hospital staff. Every access is audit logged.
          </p>
        </div>
        <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
          <button className="btn-secondary" type="button" onClick={locateBrowser}>Use My Location</button>
          <select className="legacy-input" value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value as BloodGroup)}>
            {bloodGroups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
          </select>
          <input className="legacy-input" min={1} max={200} type="number" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} />
          <button className="btn-primary" type="button" onClick={searchNearby}>Find Nearby</button>
        </div>
      </div>

      {geoMessage ? <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm text-primary">{geoMessage}</p> : null}
      {error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-primary">{error}</p> : null}

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 overflow-hidden rounded-3xl border border-red-100 bg-white shadow-soft">
          {loading ? (
            <div className="flex h-[420px] items-center justify-center text-sm font-semibold text-muted sm:h-[500px] xl:h-[560px]">Loading secure map data...</div>
          ) : (
            <MapContainer className="h-[420px] w-full sm:h-[500px] xl:h-[560px]" center={userPosition ?? center} zoom={userPosition ? 12 : 7} scrollWheelZoom>
              <RecenterMap center={userPosition ?? center} />
              <TileLayer
                attribution={ENGLISH_FRIENDLY_TILE_ATTRIBUTION}
                url={ENGLISH_FRIENDLY_TILE_URL}
              />

              {userPosition ? (
                <CircleMarker center={userPosition} radius={9} pathOptions={{ color: '#2563eb', fillColor: '#3b82f6', fillOpacity: 0.8 }}>
                  <Popup>Your current browser location</Popup>
                </CircleMarker>
              ) : null}

              {hospitals.filter((item) => item.latitude !== null && item.longitude !== null).map((hospital) => (
                <Marker key={hospital.id} position={[hospital.latitude!, hospital.longitude!]} icon={hospitalIcon}>
                  <Popup>
                    <strong>{hospital.hospitalName}</strong><br />
                    {hospital.location}<br />
                    {hospital.contactPhone}
                  </Popup>
                </Marker>
              ))}

              {requests.filter((item) => item.latitude !== null && item.longitude !== null).map((request) => (
                <Marker key={request.id} position={[request.latitude!, request.longitude!]} icon={requestIcon}>
                  <Popup>
                    <strong>{formatBloodGroup(request.bloodGroup)} request</strong><br />
                    {request.hospitalCenterName ?? request.hospital?.hospitalName ?? 'Hospital not listed'}<br />
                    {request.unitsNeeded} unit(s) - {request.priority}<br />
                    {request.status}/{request.trackingStatus}<br />
                    {request.emergencyLocation ?? request.location}<br />
                    {request.ward ? `${request.ward} • ` : ''}{[request.city, request.region].filter(Boolean).join(', ')}<br />
                    {request.requiredBy ? `Need by ${new Date(request.requiredBy).toLocaleString()}` : ''}
                  </Popup>
                </Marker>
              ))}

              {donors.filter((item) => item.latitude !== null && item.longitude !== null).map((donor) => (
                <Marker key={donor.id} position={[donor.latitude!, donor.longitude!]} icon={donorIcon}>
                  <Popup>
                    <strong>Available donor</strong><br />
                    {formatBloodGroup(donor.bloodGroup)} - {donor.areaCommunity ?? donor.city ?? donor.location}<br />
                    {donor.region ? `${donor.region}` : 'Region not specified'}<br />
                    {donor.distanceKm !== undefined ? `${donor.distanceKm.toFixed(1)}km away` : 'Live donor location'}
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          )}
        </div>

        <aside className="card min-w-0 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-primary">Map Summary</h2>
            <p className="text-sm text-muted">Live operational visibility for emergency coordination.</p>
          </div>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-red-100 p-3"><p className="text-xs uppercase text-muted">Hospitals</p><p className="text-2xl font-bold text-primary">{hospitals.length}</p></div>
            <div className="rounded-2xl border border-red-100 p-3"><p className="text-xs uppercase text-muted">Open Requests</p><p className="text-2xl font-bold text-primary">{requests.length}</p></div>
            <div className="rounded-2xl border border-red-100 p-3"><p className="text-xs uppercase text-muted">Visible Donors</p><p className="text-2xl font-bold text-primary">{donors.length}</p></div>
            <div className="rounded-2xl border border-red-100 p-3"><p className="text-xs uppercase text-muted">Coverage Regions</p><p className="text-2xl font-bold text-primary">{coverage?.regions.length ?? 0}</p></div>
          </div>
          {coverage?.regions.length ? (
            <div className="space-y-2">
              <h3 className="text-sm font-bold text-primary">Top coverage zones</h3>
              {coverage.regions.slice(0, 4).map((region) => (
                <div key={region.region} className="flex items-center justify-between rounded-2xl bg-slate-50 px-3 py-2 text-sm">
                  <span className="font-semibold text-slate-700">{region.region}</span>
                  <span className="rounded-full bg-red-100 px-2 py-1 text-xs font-bold text-primary">{region.donorCount}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl bg-slate-50 p-3 text-xs text-muted">
              No donor coverage zones yet. Donors appear here after they enable secure location sharing.
            </div>
          )}
          <div className="rounded-2xl bg-slate-50 p-3 text-xs text-muted">
            Public users cannot access this map. Donor coordinates are never shown on public emergency pages.
          </div>
        </aside>
      </div>
    </section>
  );
}
