import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { confirmedBloodGroups } from '../constants/blood-groups';
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

const makeIcon = (label: string, color: string, pixelOffset: { x: number; y: number } = { x: 0, y: 0 }) =>
  L.divIcon({
    className: 'live-map-marker',
    html: `<span style="background:${color}; transform: translate(${pixelOffset.x}px, ${pixelOffset.y}px);">${label}</span>`,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
  });

const hospitalIcon = makeIcon('H', '#0f172a');
const yourHospitalIcon = makeIcon('YOU', '#2563eb');
const bloodBankIcon = makeIcon('B', '#0f766e');
const donationCenterIcon = makeIcon('+', '#7c3aed');
const availableDonorIcon = makeIcon('D', '#16a34a');
const cooldownDonorIcon = makeIcon('D', '#64748b');
const cooldownEndingSoonDonorIcon = makeIcon('D', '#ca8a04');
const deferredDonorIcon = makeIcon('D', '#dc0d28');
const unavailableDonorIcon = makeIcon('D', '#94a3b8');
const requestIcon = makeIcon('!', '#f97316');

function formatBloodGroup(value: string) {
  return confirmedBloodGroups.find((group) => group.value === value)?.label ?? value;
}

function distanceKmBetween(from: [number, number], to: [number, number]) {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const dLat = toRad(to[0] - from[0]);
  const dLng = toRad(to[1] - from[1]);
  const lat1 = toRad(from[0]);
  const lat2 = toRad(to[0]);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, 7, { animate: true });
  }, [center, map]);
  return null;
}

type DonorMarkerItem = {
  id: string;
  position: [number, number];
  donor: MapDonor;
  pixelOffset: { x: number; y: number };
};

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
  const [currentHospitalId, setCurrentHospitalId] = useState<string | null>(null);

  const loadMap = async () => {
    setLoading(true);
    setError('');
    try {
      const payload = await getOperationsMap();
      setHospitals(payload.hospitals);
      setRequests(payload.requests);
      setDonors(payload.donors);
      setCurrentHospitalId(payload.currentHospitalId ?? null);
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
    socket.on('hospital.map.updated', () => void loadMap());
    return () => {
      socket.disconnect();
    };
  }, []);

  const center = useMemo<[number, number]>(() => ghanaCenter, []);

  const currentHospital = useMemo(
    () => hospitals.find((hospital) => hospital.id === currentHospitalId) ?? null,
    [hospitals, currentHospitalId],
  );

  const currentHospitalCoords = useMemo<[number, number] | null>(() => {
    if (!currentHospital || currentHospital.latitude === null || currentHospital.longitude === null) return null;
    return [currentHospital.latitude, currentHospital.longitude];
  }, [currentHospital]);

  const distanceFromCurrentHospital = (hospital: MapHospital) => {
    if (!currentHospitalCoords || hospital.latitude === null || hospital.longitude === null) return null;
    const toRad = (value: number) => (value * Math.PI) / 180;
    const [lat1, lng1] = currentHospitalCoords;
    const dLat = toRad(hospital.latitude - lat1);
    const dLng = toRad(hospital.longitude - lng1);
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(toRad(lat1)) * Math.cos(toRad(hospital.latitude)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const distance = 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return Number(distance.toFixed(1));
  };

  const centerTypeForHospital = (hospital: MapHospital): 'hospital' | 'blood_bank' | 'donation_center' => {
    const name = hospital.hospitalName.toLowerCase();
    const location = hospital.location.toLowerCase();
    const text = `${name} ${location}`;
    if (text.includes('blood bank') || text.includes('blood service')) return 'blood_bank';
    if (text.includes('donation') || text.includes('donor center')) return 'donation_center';
    return 'hospital';
  };

  const markerForHospital = (hospital: MapHospital) => {
    if (hospital.id === currentHospitalId) return yourHospitalIcon;
    const centerType = centerTypeForHospital(hospital);
    if (centerType === 'blood_bank') return bloodBankIcon;
    if (centerType === 'donation_center') return donationCenterIcon;
    return hospitalIcon;
  };

  const donorStatusLabel = (donor: MapDonor) => {
    if (donor.operationalStatus === 'AVAILABLE') return 'Available';
    if (donor.operationalStatus === 'COOLDOWN_ENDING_SOON') return 'Cooldown ending soon';
    if (donor.operationalStatus === 'COOLDOWN') return 'Cooldown';
    if (donor.operationalStatus === 'DEFERRED') return 'Deferred';
    return 'Unavailable';
  };

  const donorStatusBadgeClass = (donor: MapDonor) => {
    if (donor.operationalStatus === 'AVAILABLE') return 'bg-green-100 text-green-700';
    if (donor.operationalStatus === 'COOLDOWN_ENDING_SOON') return 'bg-amber-100 text-amber-700';
    if (donor.operationalStatus === 'COOLDOWN') return 'bg-slate-200 text-slate-700';
    if (donor.operationalStatus === 'DEFERRED') return 'bg-red-100 text-red-700';
    return 'bg-slate-100 text-slate-600';
  };

  const donorResponseRateText = (donor: MapDonor) => {
    const responseCount = donor.responseCount ?? 0;
    if (responseCount < 3) return 'No data yet';
    const acceptedCount = donor.acceptedResponseCount ?? 0;
    return `${Math.round((acceptedCount / responseCount) * 100)}% (${acceptedCount}/${responseCount})`;
  };

  const formatDateShort = (date?: string | null) =>
    date
      ? new Intl.DateTimeFormat('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(date))
      : 'Not recorded';

  const formatDistance = (donor: MapDonor) => {
    const distance = donor.distanceFromCurrentHospitalKm ?? donor.distanceKm ?? null;
    return typeof distance === 'number' ? `${Math.round(distance)} km away` : 'Not available';
  };

  const availableInText = (donor: MapDonor) => {
    if (donor.operationalStatus === 'AVAILABLE') return 'Now';
    if (!donor.cooldownDaysRemaining) return 'Not available';
    return `${donor.cooldownDaysRemaining} ${donor.cooldownDaysRemaining === 1 ? 'day' : 'days'} remaining`;
  };

  const donorIsActionable = (donor: MapDonor) => donor.operationalStatus === 'AVAILABLE';

  const disabledActionClass = 'rounded-lg border border-slate-200 bg-slate-100 px-2 py-1.5 text-center text-[10px] font-bold text-slate-400';
  const actionLinkClass = 'rounded-lg border border-red-200 bg-white px-2 py-1.5 text-center text-[10px] font-bold text-primary hover:bg-red-50';

  const donorMarkerColor = (donor: MapDonor) => {
    if (donor.operationalStatus === 'AVAILABLE') return '#16a34a';
    if (donor.operationalStatus === 'COOLDOWN_ENDING_SOON') return '#ca8a04';
    if (donor.operationalStatus === 'COOLDOWN') return '#64748b';
    if (donor.operationalStatus === 'DEFERRED') return '#dc0d28';
    return '#94a3b8';
  };

  const markerForDonor = (donor: MapDonor, pixelOffset: { x: number; y: number } = { x: 0, y: 0 }) => {
    if (pixelOffset.x === 0 && pixelOffset.y === 0) {
      if (donor.operationalStatus === 'AVAILABLE') return availableDonorIcon;
      if (donor.operationalStatus === 'COOLDOWN_ENDING_SOON') return cooldownEndingSoonDonorIcon;
      if (donor.operationalStatus === 'COOLDOWN') return cooldownDonorIcon;
      if (donor.operationalStatus === 'DEFERRED') return deferredDonorIcon;
      return unavailableDonorIcon;
    }

    return makeIcon('D', donorMarkerColor(donor), pixelOffset);
  };

  const donorMarkerItems = useMemo<DonorMarkerItem[]>(() => {
    const visibleDonors = donors.filter((donor) => donor.latitude !== null && donor.longitude !== null);
    const groups: MapDonor[][] = [];

    visibleDonors.forEach((donor) => {
      const donorPosition: [number, number] = [donor.latitude!, donor.longitude!];
      const existingGroup = groups.find((group) => {
        const firstDonor = group[0];
        const groupPosition: [number, number] = [firstDonor.latitude!, firstDonor.longitude!];
        const distance = distanceKmBetween(groupPosition, donorPosition);
        return distance <= 0.2;
      });

      if (existingGroup) {
        existingGroup.push(donor);
        return;
      }

      groups.push([donor]);
    });

    return groups.flatMap((group) => {
      if (group.length === 1) {
        const donor = group[0];
        return [{ id: donor.id, donor, position: [donor.latitude!, donor.longitude!] as [number, number], pixelOffset: { x: 0, y: 0 } }];
      }

      const centerLatitude = group.reduce((sum, donor) => sum + donor.latitude!, 0) / group.length;
      const centerLongitude = group.reduce((sum, donor) => sum + donor.longitude!, 0) / group.length;
      const offsetRadiusPx = 28;

      return group.map((donor, index) => {
        const angle = (-Math.PI / 4) + (2 * Math.PI * index) / group.length;
        return {
          id: donor.id,
          donor,
          position: [Number(centerLatitude.toFixed(3)), Number(centerLongitude.toFixed(3))] as [number, number],
          pixelOffset: {
            x: Math.round(Math.cos(angle) * offsetRadiusPx),
            y: Math.round(Math.sin(angle) * offsetRadiusPx),
          },
        };
      });
    });
  }, [donors]);

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
            Live donor markers are restricted to authorized admins and hospital staff for emergency coordination only.
          </p>
        </div>
        <div className="grid w-full min-w-0 gap-2 sm:grid-cols-2 xl:w-auto xl:grid-cols-4">
          <button className="btn-secondary" type="button" onClick={locateBrowser}>Use My Location</button>
          {!currentHospitalId ? (
            <>
              <select className="legacy-input" value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value as BloodGroup)}>
                {confirmedBloodGroups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}
              </select>
              <input className="legacy-input" min={1} max={200} type="number" value={radiusKm} onChange={(event) => setRadiusKm(Number(event.target.value))} />
              <button className="btn-primary" type="button" onClick={searchNearby}>Find Nearby</button>
            </>
          ) : null}
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
                <Marker key={hospital.id} position={[hospital.latitude!, hospital.longitude!]} icon={markerForHospital(hospital)}>
                  <Popup>
                    <strong>{hospital.hospitalName}{hospital.id === currentHospitalId ? ' (Your Hospital)' : ''}</strong><br />
                    {[hospital.city, hospital.region].filter(Boolean).join(', ') || hospital.location}<br />
                    Blood Bank Available: {hospital.bloodBankAvailable ? 'Yes' : 'No'}<br />
                    {distanceFromCurrentHospital(hospital) !== null && hospital.id !== currentHospitalId ? `${distanceFromCurrentHospital(hospital)} km away` : ''}
                    {hospital.inventoryItems && hospital.inventoryItems.length > 0 ? (
                      <>
                        <br /><strong>Available Blood Types</strong><br />
                        {hospital.inventoryItems.slice(0, 8).map((item) => (
                          <span key={`${hospital.id}-${item.bloodGroup}`}>
                            {formatBloodGroup(item.bloodGroup)}: {item.availableUnits} Units<br />
                          </span>
                        ))}
                      </>
                    ) : (
                      <><br />No published inventory yet</>
                    )}
                    <br />Stock Status: {hospital.stockStatus ?? 'unknown'}
                    <br />{hospital.contactPhone}
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

              {donorMarkerItems.map((item) => (
                <Marker key={item.id} position={item.position} icon={markerForDonor(item.donor, item.pixelOffset)}>
                  <Popup>
                    <div className="w-72 overflow-hidden rounded-2xl border border-slate-200 bg-white text-xs text-slate-700 shadow-lg">
                      <div className="border-b border-slate-100 bg-slate-50 px-3 py-2">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <strong className="block truncate text-sm text-slate-950">{item.donor.fullName ?? 'Operational donor'}</strong>
                            <span className="text-[10px] font-semibold text-slate-500">{item.donor.donorNumber ?? 'Donor reference unavailable'}</span>
                          </div>
                          <div className="flex shrink-0 flex-col items-end gap-1">
                            <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-primary">
                              {formatBloodGroup(item.donor.bloodGroup)}
                            </span>
                            <span className={`rounded-full px-2 py-0.5 text-[10px] font-black ${donorStatusBadgeClass(item.donor)}`}>
                              {donorStatusLabel(item.donor)}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 px-3 py-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Last Donation</p>
                          <p className="font-bold text-slate-800">{formatDateShort(item.donor.lastDonationDate)}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Next Eligible</p>
                          <p className="font-bold text-slate-800">{formatDateShort(item.donor.nextEligibilityDate)}</p>
                        </div>
                        <div className="col-span-2 rounded-xl bg-slate-50 px-2 py-1">
                          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">Available In</p>
                          <p className="font-bold text-slate-800">{availableInText(item.donor)}</p>
                        </div>
                      </div>

                      <div className="border-y border-slate-100 px-3 py-2">
                        <div className="grid grid-cols-[92px_minmax(0,1fr)] gap-y-1">
                          <span className="font-semibold text-slate-500">Distance</span>
                          <span className="font-bold text-slate-800">{formatDistance(item.donor)}</span>
                          <span className="font-semibold text-slate-500">Preferred Center</span>
                          <span className="truncate text-slate-800">{item.donor.preferredDonationCenter?.hospitalName ?? 'Not selected'}</span>
                          <span className="font-semibold text-slate-500">Total Donations</span>
                          <span className="font-bold text-slate-800">{item.donor.totalDonations ?? 0}</span>
                          <span className="font-semibold text-slate-500">Response History</span>
                          <span className="text-slate-800">{donorResponseRateText(item.donor)}</span>
                        </div>
                      </div>

                      <div className="px-3 py-2">
                        <p><span className="font-semibold text-slate-500">Area:</span> <span className="text-slate-800">{item.donor.areaCommunity ?? item.donor.city ?? item.donor.location}</span></p>
                        {item.donor.region ? (
                          <p><span className="font-semibold text-slate-500">Region:</span> <span className="text-slate-800">{item.donor.region}</span></p>
                        ) : null}
                      </div>

                      {!donorIsActionable(item.donor) ? (
                        <p className="mx-3 rounded-xl bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-600">
                          {item.donor.operationalStatus === 'DEFERRED'
                            ? 'Donor is deferred. Scheduling and alerts are disabled.'
                            : `Available after ${formatDateShort(item.donor.nextEligibilityDate)}.`}
                        </p>
                      ) : null}

                      <div className="grid gap-1.5 p-3">
                        {donorIsActionable(item.donor) ? (
                          <Link className={actionLinkClass} to={`/hospital/appointments?donorId=${item.donor.id}`}>
                            Schedule Appointment
                          </Link>
                        ) : (
                          <button className={disabledActionClass} type="button" disabled title="Donor is not currently available for appointment scheduling.">
                            Schedule Appointment
                          </button>
                        )}

                        {donorIsActionable(item.donor) ? (
                          <Link className={actionLinkClass} to={`/hospital/request-blood?bloodGroup=${item.donor.bloodGroup}&source=map&donorId=${item.donor.id}`}>
                            Create Emergency Request
                          </Link>
                        ) : (
                          <button className={disabledActionClass} type="button" disabled title="Emergency request actions are disabled for cooldown or deferred donors.">
                            Create Emergency Request
                          </button>
                        )}

                        <button
                          className={disabledActionClass}
                          type="button"
                          disabled
                          title="Open donor search to send alerts through the approved workflow."
                        >
                          Contact Donor / Send Alert
                        </button>
                      </div>
                    </div>
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
          {hospitals.length === 0 ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              No map-ready hospitals found. Add/verify hospital coordinates and keep hospital approval + blood bank availability enabled.
            </div>
          ) : null}
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
          {currentHospital ? (
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-3 text-xs text-blue-800">
              Your Hospital: {currentHospital.hospitalName}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
