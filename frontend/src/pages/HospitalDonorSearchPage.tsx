import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { confirmedBloodGroups } from '../constants/blood-groups';
import {
  type BloodGroup,
  type BloodRequestItem,
  type DonorLocatorResponse,
  type DonorMatch,
  type HospitalProfile,
  getHospitalActiveRequestById,
  getHospitalProfile,
  searchHospitalDonors,
} from '../services/hospital-portal';
import { FilterBox, Pager } from '../components/TableControls';
import { ENGLISH_FRIENDLY_TILE_ATTRIBUTION, ENGLISH_FRIENDLY_TILE_URL } from '../constants/map-tiles';
import { createRealtimeSocket } from '../services/live-map';
import { formatHospitalDisplayName } from '../utils/hospital-display';

const ghanaCenter: [number, number] = [7.9465, -1.0232];

const statusStyles: Record<string, string> = {
  AVAILABLE: 'bg-green-50 text-green-700 ring-green-200',
  COOLDOWN_ENDING_SOON: 'bg-yellow-50 text-yellow-800 ring-yellow-200',
  COOLDOWN: 'bg-slate-100 text-slate-700 ring-slate-200',
  DEFERRED: 'bg-red-50 text-red-700 ring-red-200',
  UNAVAILABLE: 'bg-gray-100 text-gray-600 ring-gray-200',
};

const markerColors: Record<string, string> = {
  AVAILABLE: '#16a34a',
  COOLDOWN_ENDING_SOON: '#ca8a04',
  COOLDOWN: '#64748b',
  DEFERRED: '#dc2626',
  UNAVAILABLE: '#94a3b8',
};

const markerLabels: Record<string, string> = {
  AVAILABLE: 'Available eligible donor',
  COOLDOWN_ENDING_SOON: 'Cooling-period donor',
  COOLDOWN: 'Cooling-period donor',
  DEFERRED: 'Unavailable or deferred donor',
  UNAVAILABLE: 'Unavailable donor',
  ORIGIN: 'Hospital, request, or selected search origin',
  STALE: 'Stale or limited location data',
};

function formatBloodGroup(value?: string | null) {
  return confirmedBloodGroups.find((group) => group.value === value)?.label ?? value ?? 'Not confirmed';
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString();
}

function locationFreshnessLabel(donor: DonorMatch) {
  if (donor.locationFreshness?.label) return donor.locationFreshness.label;
  if (!donor.lastLocationUpdateAt) return 'Location not available';
  const updated = new Date(donor.lastLocationUpdateAt);
  if (Number.isNaN(updated.getTime())) return 'Location not available';
  return `Updated ${updated.toLocaleString()}`;
}

function distanceLabel(donor: DonorMatch) {
  if (donor.distanceKm === null || donor.distanceKm === undefined) return 'Distance unavailable';
  if (donor.locationFreshness?.status === 'STALE') return `About ${donor.distanceKm} km away; location may be outdated`;
  return `${donor.distanceKm} km away`;
}

function donorMarkerType(donor: DonorMatch) {
  if (donor.locationFreshness?.status === 'STALE') return 'STALE';
  return donor.operationalStatus ?? 'UNAVAILABLE';
}

function statusLabel(status?: string) {
  if (status === 'AVAILABLE') return 'Available';
  if (status === 'COOLDOWN_ENDING_SOON') return 'Cooldown ending soon';
  if (status === 'COOLDOWN') return 'In cooldown';
  if (status === 'DEFERRED') return 'Deferred';
  return 'Unavailable';
}

function RecenterMap({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, center === ghanaCenter ? 7 : 10, { animate: true });
  }, [center, map]);
  return null;
}

export default function HospitalDonorSearchPage() {
  const [searchParams] = useSearchParams();
  const requestId = searchParams.get('requestId') ?? '';
  const requestReference = searchParams.get('requestReference') ?? '';
  const source = searchParams.get('source') ?? '';
  const approvedAvailableFilter = searchParams.get('approval') === 'approved' && searchParams.get('available') === 'true';
  const initialBloodGroup = (searchParams.get('bloodGroup') as BloodGroup | null) ?? '';
  const initialRadiusKm = Number(searchParams.get('radiusKm'));
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | ''>(initialBloodGroup);
  const [matchMode, setMatchMode] = useState<'EXACT' | 'COMPATIBLE'>(
    searchParams.get('compatible') === 'true' ? 'COMPATIBLE' : 'EXACT',
  );
  const [availabilityFilter, setAvailabilityFilter] = useState<'AVAILABLE_ONLY' | 'INCLUDE_COOLDOWN' | 'INCLUDE_DEFERRED' | 'ALL_APPROVED'>('AVAILABLE_ONLY');
  const [location, setLocation] = useState('');
  const [radiusKm, setRadiusKm] = useState(Number.isFinite(initialRadiusKm) && initialRadiusKm > 0 ? initialRadiusKm : 25);
  const [emergencyMode, setEmergencyMode] = useState(searchParams.get('emergency') === 'true' || searchParams.get('notify') === '1');
  const [browserPosition, setBrowserPosition] = useState<[number, number] | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [realtimeMessage, setRealtimeMessage] = useState('');
  const [realtimeUpdating, setRealtimeUpdating] = useState(false);
  const [activeRequest, setActiveRequest] = useState<BloodRequestItem | null>(null);
  const [hospitalProfile, setHospitalProfile] = useState<HospitalProfile | null>(null);
  const [requestLoading, setRequestLoading] = useState(Boolean(requestId));
  const [results, setResults] = useState<DonorMatch[]>([]);
  const [summary, setSummary] = useState<DonorLocatorResponse['summary'] | null>(null);
  const [selectedMapDonor, setSelectedMapDonor] = useState<DonorMatch | null>(null);
  const latestSearchRef = useRef<() => Promise<void>>(async () => undefined);
  const realtimeTimerRef = useRef<number | null>(null);
  const realtimeStateRef = useRef({
    results: [] as DonorMatch[],
    summary: null as DonorLocatorResponse['summary'] | null,
    bloodGroup: '' as BloodGroup | '',
    matchMode: 'EXACT' as 'EXACT' | 'COMPATIBLE',
    requestId: '',
  });
  const pageSize = 12;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = await searchHospitalDonors({
        bloodGroup: bloodGroup || undefined,
        requestId: requestId || undefined,
        location: location.trim() || undefined,
        matchMode,
        availabilityFilter,
        radiusKm,
        emergencyMode,
        latitude: browserPosition?.[0],
        longitude: browserPosition?.[1],
      });
      setResults(payload.donors);
      setSummary(payload.summary);
      setErrorMessage('');
      setMessage(
        payload.summary.staleLocationCount
          ? 'Some donor locations may be outdated.'
          : payload.summary.radiusFallback.applied
            ? `No donors were inside ${payload.summary.radiusFallback.requestedRadiusKm}km, so nearest eligible donor options are shown.`
            : `Found ${payload.summary.totalMatches} donor option(s).`,
      );
    } catch (error: any) {
      setErrorMessage(error?.response?.data?.error?.message ?? 'Unable to retrieve donor matches. Please try again.');
      setMessage('');
      setResults([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  latestSearchRef.current = async () => {
    const payload = await searchHospitalDonors({
      bloodGroup: bloodGroup || undefined,
      requestId: requestId || undefined,
      location: location.trim() || undefined,
      matchMode,
      availabilityFilter,
      radiusKm,
      emergencyMode,
      latitude: browserPosition?.[0],
      longitude: browserPosition?.[1],
    });
    setResults(payload.donors);
    setSummary(payload.summary);
    setErrorMessage('');
  };
  realtimeStateRef.current = { results, summary, bloodGroup, matchMode, requestId };

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const queryBloodGroup = searchParams.get('bloodGroup') as BloodGroup | null;
    if (queryBloodGroup) setBloodGroup(queryBloodGroup);
    if (searchParams.get('compatible') === 'true') setMatchMode('COMPATIBLE');
    if (searchParams.get('available') === 'true' || searchParams.get('eligible') === 'true') {
      setAvailabilityFilter('AVAILABLE_ONLY');
    }
    const queryRadiusKm = Number(searchParams.get('radiusKm'));
    if (Number.isFinite(queryRadiusKm) && queryRadiusKm > 0) {
      setRadiusKm(queryRadiusKm);
    }
    if (searchParams.get('emergency') === 'true' || searchParams.get('notify') === '1') setEmergencyMode(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (source !== 'early-warning') return;
    let mounted = true;
    getHospitalProfile()
      .then((profile) => {
        if (mounted) setHospitalProfile(profile);
      })
      .catch(() => {
        if (mounted) setHospitalProfile(null);
      });
    return () => {
      mounted = false;
    };
  }, [source]);

  useEffect(() => {
    if (!requestId) {
      setActiveRequest(null);
      return;
    }
    let mounted = true;
    setRequestLoading(true);
    getHospitalActiveRequestById(requestId)
      .then((request) => {
        if (!mounted) return;
        setActiveRequest(request);
        setBloodGroup(request.bloodGroup);
        setMatchMode('COMPATIBLE');
        setEmergencyMode(true);
      })
      .catch(() => {
        if (mounted) setMessage('No emergency request is currently selected. You can perform a general donor search.');
      })
      .finally(() => {
        if (mounted) setRequestLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [requestId]);

  useEffect(() => {
    if (requestId && requestLoading) return;
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestId, requestLoading]);

  useEffect(() => {
    const socket = createRealtimeSocket();
    const currentDonorIds = () => new Set(realtimeStateRef.current.results.map((donor) => donor.id));
    const compatibleExactMatch = (payload: any) => {
      const state = realtimeStateRef.current;
      return state.matchMode !== 'EXACT' || !payload?.bloodGroup || payload.bloodGroup === state.bloodGroup;
    };
    const relatedHospital = (payload: any) => {
      const hospitalId = payload?.hospitalId;
      if (!hospitalId) return true;
      const context = realtimeStateRef.current.summary?.requestContext;
      return (
        context?.loggedInHospital?.id === hospitalId ||
        context?.requestingHospital?.id === hospitalId ||
        realtimeStateRef.current.summary?.origin?.source !== 'request'
      );
    };
    const shouldRefresh = (channel: string, payload: any) => {
      if (channel === 'emergency.request.updated') {
        const currentRequestId = realtimeStateRef.current.requestId;
        if (currentRequestId) return payload?.requestId === currentRequestId || payload?.id === currentRequestId;
        return relatedHospital(payload);
      }
      if (channel === 'hospital.map.updated') return relatedHospital(payload);
      if (channel === 'donor.location.updated') return !payload?.donorId || currentDonorIds().has(payload.donorId);
      if (channel === 'donor.search.invalidated') return compatibleExactMatch(payload) || currentDonorIds().has(payload?.donorId);
      if (channel === 'donor.response.updated') return requestId ? payload?.requestId === requestId : true;
      return false;
    };
    const scheduleRefresh = (channel: string, payload: any) => {
      if (!shouldRefresh(channel, payload)) return;
      if (channel === 'emergency.request.updated' && realtimeStateRef.current.requestId && ['FULFILLED', 'COMPLETED', 'CANCELLED', 'CANCELED'].includes(String(payload?.status ?? payload?.trackingStatus ?? '').toUpperCase())) {
        setActiveRequest(null);
        setMessage('The active emergency request changed status. You can continue with a general donor search.');
      }
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      realtimeTimerRef.current = window.setTimeout(async () => {
        setRealtimeUpdating(true);
        try {
          await latestSearchRef.current();
          setRealtimeMessage('Donor results updated.');
        } catch {
          setRealtimeMessage('Live donor update could not refresh results. Current results were preserved.');
        } finally {
          setRealtimeUpdating(false);
        }
      }, 1200);
    };
    const channels = [
      'donor.search.invalidated',
      'donor.location.updated',
      'donor.response.updated',
      'emergency.request.updated',
      'hospital.map.updated',
    ];
    channels.forEach((channel) => socket.on(channel, (payload) => scheduleRefresh(channel, payload)));
    return () => {
      if (realtimeTimerRef.current) window.clearTimeout(realtimeTimerRef.current);
      channels.forEach((channel) => socket.off(channel));
      socket.disconnect();
    };
  }, []);

  const locateBrowser = () => {
    if (!navigator.geolocation) {
      setMessage('Browser location is not available. The search will use the hospital location when possible.');
      return;
    }
    setMessage('Requesting browser location...');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setBrowserPosition([position.coords.latitude, position.coords.longitude]);
        setMessage(`Browser location captured. Accuracy about ${Math.round(position.coords.accuracy)}m.`);
      },
      () => setMessage('Browser location was denied. The search will use the hospital location when possible.'),
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 30000 },
    );
  };

  const filteredResults = useMemo(
    () =>
      results.filter((donor) => {
        if (!searchTerm) return true;
        return [
          donor.fullName,
          donor.donorNumber,
          donor.location,
          donor.city,
          donor.region,
          donor.bloodGroup,
          donor.preferredHospital?.hospitalName,
        ]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(searchTerm));
      }),
    [results, searchTerm],
  );

  useEffect(() => {
    setPage(0);
  }, [searchTerm, results]);

  const totalPages = Math.max(1, Math.ceil(filteredResults.length / pageSize));
  const start = page * pageSize;
  const pagedResults = filteredResults.slice(start, start + pageSize);
  const mapDonors = filteredResults.filter((donor) => donor.mapLocationAvailable && donor.latitude !== null && donor.longitude !== null);
  const markerTypes = Array.from(new Set([
    summary?.origin ? 'ORIGIN' : null,
    ...mapDonors.map(donorMarkerType),
  ].filter(Boolean) as string[]));
  const requestContext = summary?.requestContext;
  const contextRequest = requestContext ?? (activeRequest
    ? {
        id: activeRequest.id,
        requestReference: activeRequest.requestReference,
        bloodGroup: activeRequest.bloodGroup,
        bloodComponent: 'Whole blood',
        unitsNeeded: activeRequest.unitsNeeded,
        priority: activeRequest.priority,
        requestSource: activeRequest.requestSource,
        type: activeRequest.type,
        location: activeRequest.emergencyLocation ?? activeRequest.location,
        city: activeRequest.city,
        region: activeRequest.region,
        requestingHospital: activeRequest.hospital ?? { id: '', hospitalName: activeRequest.hospitalCenterName ?? 'Requesting hospital', location: activeRequest.location },
        loggedInHospital: null,
        interHospital: Boolean(activeRequest.isOwnRequest === false),
      }
    : null);
  const earlyWarningContext =
    source === 'early-warning'
      ? `Previewing compatible donors for ${formatBloodGroup(bloodGroup)} stock shortage at ${
          hospitalProfile?.hospitalName ?? summary?.origin?.hospitalName ?? 'the current hospital'
        }.`
      : '';
  const mapCenter: [number, number] = summary?.origin
    ? [summary.origin.latitude, summary.origin.longitude]
    : mapDonors[0]?.latitude && mapDonors[0]?.longitude
      ? [mapDonors[0].latitude, mapDonors[0].longitude]
      : ghanaCenter;

  return (
    <section className="space-y-5">
      <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-white p-5 shadow-sm">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-red-600">Privacy-safe donor coordination</p>
        <h1 className="mt-1 text-2xl font-black text-primary">Smart Donor Locator</h1>
        <p className="mt-2 max-w-4xl text-sm text-muted">
          Search approved donors by compatibility, availability, cooldown status, and secure location sharing. Donor markers are only visible to authorized hospital and admin users.
        </p>
      </div>

      <div className="card space-y-3" aria-live="polite">
        {requestLoading ? (
          <p className="text-sm font-semibold text-muted">Loading emergency request context...</p>
        ) : contextRequest ? (
          <>
            <p className="text-sm font-bold text-primary">
              Searching compatible donors for a {formatBloodGroup(contextRequest.bloodGroup)} emergency request at {contextRequest.requestingHospital.hospitalName}.
            </p>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Request ID" value={contextRequest.requestReference || requestReference || contextRequest.id} />
              <Info label="Blood Component" value={contextRequest.bloodComponent} />
              <Info label="Units Required" value={String(contextRequest.unitsNeeded)} />
              <Info label="Priority" value={contextRequest.priority} />
              <Info label="Requesting Hospital" value={contextRequest.requestingHospital.hospitalName} />
              {requestContext?.loggedInHospital ? <Info label="Logged-in Hospital" value={requestContext.loggedInHospital.hospitalName} /> : null}
              <Info label="Search Origin" value={summary?.origin?.hospitalName ?? contextRequest.requestingHospital.hospitalName} />
              <Info label="Matching Mode" value={matchMode === 'COMPATIBLE' ? 'Compatible Match' : 'Exact Match'} />
            </div>
            {contextRequest.interHospital ? (
              <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
                Inter-hospital request: donor search uses the requesting hospital as the origin while keeping your logged-in hospital context visible.
              </p>
            ) : null}
          </>
        ) : earlyWarningContext ? (
          <>
            <p className="text-sm font-bold text-primary">{earlyWarningContext}</p>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Blood Group" value={bloodGroup ? formatBloodGroup(bloodGroup) : 'All Blood Groups'} />
              <Info label="Matching Mode" value={matchMode === 'COMPATIBLE' ? 'Compatible Match' : 'Exact Match'} />
              <Info label="Donor Availability" value="Available and eligible donors only" />
              <Info label="Search Origin" value={summary?.origin?.hospitalName ?? hospitalProfile?.hospitalName ?? 'Current hospital'} />
            </div>
            <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
              This preview does not send notifications. Launch outreach from the dashboard campaign confirmation flow.
            </p>
          </>
        ) : approvedAvailableFilter ? (
          <>
            <p className="text-sm font-bold text-primary">
              Showing approved and currently available donors for this hospital's authorized donor search scope.
            </p>
            <div className="grid gap-3 md:grid-cols-4">
              <Info label="Blood Group" value="All Blood Groups" />
              <Info label="Matching Mode" value={matchMode === 'COMPATIBLE' ? 'Compatible Match' : 'Exact Match'} />
              <Info label="Donor Availability" value="Available and eligible donors only" />
              <Info label="Approval" value="Hospital-approved donors only" />
            </div>
          </>
        ) : (
          <p className="text-sm font-semibold text-muted">General donor search for the logged-in hospital.</p>
        )}
      </div>

      <form className="card grid gap-3 lg:grid-cols-4" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Blood Needed
          <select className="legacy-input mt-1" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup | '')}>
            <option value="">All Blood Groups</option>
            {confirmedBloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Matching Method
          <select className="legacy-input mt-1" value={matchMode} onChange={(e) => setMatchMode(e.target.value as 'EXACT' | 'COMPATIBLE')}>
            <option value="EXACT">Exact Match</option>
            <option value="COMPATIBLE">Compatible Match</option>
          </select>
          {matchMode === 'COMPATIBLE' ? (
            <span className="mt-1 block text-xs font-medium text-muted">
              Shows donor blood groups that can safely donate to the selected recipient blood group according to the platform's compatibility rules.
            </span>
          ) : null}
        </label>
        <label className="text-sm font-semibold">
          Donor Availability
          <select className="legacy-input mt-1" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value as typeof availabilityFilter)}>
            <option value="AVAILABLE_ONLY">Available only</option>
            <option value="INCLUDE_COOLDOWN">Include cooldown</option>
            <option value="INCLUDE_DEFERRED">Include deferred</option>
            <option value="ALL_APPROVED">All approved donors</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Search Radius
          <input className="legacy-input mt-1" min={1} max={300} type="number" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
        </label>
        <label className="text-sm font-semibold lg:col-span-2">
          Hospital or Request Location
          <input className="legacy-input mt-1" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Leave blank to use hospital location" />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-red-100 px-4 py-3 text-sm font-semibold">
          <input type="checkbox" checked={emergencyMode} onChange={(event) => setEmergencyMode(event.target.checked)} />
          Emergency Search
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={locateBrowser}>Use Browser Location</button>
          <button className="btn-primary" disabled={loading || requestLoading} type="submit">{loading ? 'Searching...' : 'Search Donors'}</button>
        </div>
      </form>

      {summary?.origin ? (
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800">
          Search origin: {summary.origin.hospitalName}{summary.origin.location ? `, ${summary.origin.location}` : ''}. Selected radius: {radiusKm} km.
        </p>
      ) : null}
      {message ? <p className="rounded-xl border border-amber-100 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800" aria-live="polite">{message}</p> : null}
      {(realtimeMessage || realtimeUpdating) ? (
        <p className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm font-semibold text-blue-800" aria-live="polite">
          {realtimeUpdating ? 'Refreshing donor results...' : realtimeMessage}
        </p>
      ) : null}
      {errorMessage ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-primary" aria-live="assertive">
          <span>{errorMessage}</span>
          <button className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-bold" type="button" onClick={() => void submit()}>
            Retry
          </button>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Matched Donors" value={summary?.totalMatches ?? results.length} helper="Donors meeting the current matching criteria" />
        <Metric label="Available Now" value={summary?.availableCount ?? 0} helper="Eligible donors currently marked available" />
        <Metric label="Cooling Period" value={summary?.cooldownCount ?? 0} helper="Donors not yet eligible to donate again" />
        <Metric label="Location Available" value={summary?.mapReadyCount ?? mapDonors.length} helper="Matched donors with usable map coordinates" />
      </div>

      {summary?.exclusionSummary ? (
        <div className="card">
          <h2 className="text-lg font-bold text-primary">Matching Diagnostics</h2>
          <p className="mt-1 text-sm text-muted">
            Evaluated donors: {summary.evaluatedDonors ?? 0}. Matched: {summary.totalMatches}. Exact Match requires the donor blood group to equal the selected group. Compatible Match uses the platform compatibility matrix.
          </p>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
            {Object.entries(summary.exclusionSummary).map(([key, value]) => (
              <div key={key} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
                <p className="text-xs font-black uppercase tracking-wide text-slate-500">{key.replace(/([A-Z])/g, ' $1')}</p>
                <p className="mt-1 text-xl font-black text-slate-900">{value}</p>
              </div>
            ))}
          </div>
          {summary.totalMatches === 0 ? (
            <p className="mt-3 rounded-xl border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              No donors matched all current filters. Try increasing the radius, removing the location restriction, changing availability, or reviewing the exclusion summary.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="card overflow-hidden p-0">
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-lg font-bold text-primary">Secure Donor Map</h2>
            <p className="text-sm text-muted">Approximate donor markers appear only when secure location sharing is enabled.</p>
          </div>
          {loading ? (
            <div className="flex h-[420px] items-center justify-center p-6 text-center text-sm font-semibold text-muted" aria-live="polite">
              Searching for compatible donors...
            </div>
          ) : errorMessage ? (
            <div className="flex h-[420px] flex-col items-center justify-center gap-3 p-6 text-center text-sm text-muted">
              <p>Unable to load the donor map. Please retry.</p>
              <button className="btn-secondary" type="button" onClick={() => void submit()}>Retry</button>
            </div>
          ) : results.length > 0 && mapDonors.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center p-6 text-center text-sm text-muted">
              Matching donors were found, but no usable location data is available.
            </div>
          ) : mapDonors.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center p-6 text-center text-sm text-muted">
              No eligible donors were found within the selected radius.
            </div>
          ) : (
            <div className="relative">
              <MapContainer className="h-[420px] w-full xl:h-[520px]" center={mapCenter} zoom={mapCenter === ghanaCenter ? 7 : 10} scrollWheelZoom>
                <RecenterMap center={mapCenter} />
                <TileLayer attribution={ENGLISH_FRIENDLY_TILE_ATTRIBUTION} url={ENGLISH_FRIENDLY_TILE_URL} />
                {summary?.origin ? (
                  <CircleMarker center={[summary.origin.latitude, summary.origin.longitude]} radius={10} pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.8 }}>
                    <Popup>
                      <strong>{formatHospitalDisplayName(summary.origin.hospitalName)}</strong><br />
                      Marker type: {markerLabels.ORIGIN}<br />
                      Location: {summary.origin.location ?? 'Hospital/request location'}<br />
                      {contextRequest ? (
                        <>
                          Active request: {formatBloodGroup(contextRequest.bloodGroup)}<br />
                          Priority: {contextRequest.priority}<br />
                          Units required: {contextRequest.unitsNeeded}<br />
                          <Link to={`/hospital/active-requests?requestId=${contextRequest.id}`}>View Request</Link>
                        </>
                      ) : null}
                    </Popup>
                  </CircleMarker>
                ) : null}
                {mapDonors.map((donor) => {
                  const markerType = donorMarkerType(donor);
                  const markerColor = markerType === 'STALE' ? '#d97706' : markerColors[donor.operationalStatus ?? 'UNAVAILABLE'];
                  return (
                    <CircleMarker
                      key={donor.id}
                      center={[donor.latitude!, donor.longitude!]}
                      radius={9}
                      pathOptions={{
                        color: markerColor,
                        fillColor: markerColor,
                        fillOpacity: 0.82,
                      }}
                      eventHandlers={{
                        click: () => setSelectedMapDonor(donor),
                      }}
                    >
                      <Tooltip direction="top" offset={[0, -12]} opacity={1} sticky={false}>
                        <strong>{donor.fullName}</strong><br />
                        {formatBloodGroup(donor.bloodGroup)} - {donor.matchType === 'EXACT' ? 'Exact match' : 'Compatible match'}<br />
                        Eligibility: {donor.eligibilityStatus ? 'Approved' : 'Review needed'}<br />
                        Availability: {statusLabel(donor.operationalStatus)}<br />
                        Distance: {distanceLabel(donor)}<br />
                        Location: {locationFreshnessLabel(donor)}
                      </Tooltip>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
              <MapLegend markerTypes={markerTypes} />
              {selectedMapDonor ? (
                <div className="absolute bottom-4 left-4 z-[450] max-w-sm rounded-2xl border border-slate-200 bg-white p-4 text-sm shadow-xl">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-black text-slate-950">{selectedMapDonor.fullName}</p>
                      <p className="text-xs font-semibold text-muted">
                        {selectedMapDonor.donorNumber ?? 'Approved donor identifier unavailable'} - {formatBloodGroup(selectedMapDonor.bloodGroup)}
                      </p>
                    </div>
                    <button className="text-xs font-black text-slate-500" onClick={() => setSelectedMapDonor(null)} type="button">
                      Close
                    </button>
                  </div>
                  <div className="mt-3 grid gap-1 text-xs text-slate-700">
                    <span>Compatibility: <strong>{selectedMapDonor.matchType === 'EXACT' ? 'Exact match' : 'Compatible match'}</strong></span>
                    <span>Eligibility: <strong>{selectedMapDonor.eligibilityStatus ? 'Approved' : 'Not eligible'}</strong></span>
                    <span>Availability: <strong>{statusLabel(selectedMapDonor.operationalStatus)}</strong></span>
                    <span>Distance: <strong>{distanceLabel(selectedMapDonor)}</strong></span>
                    <span>Location freshness: <strong>{locationFreshnessLabel(selectedMapDonor)}</strong></span>
                    <span>Match: <strong>{selectedMapDonor.matchReasonSummary ?? 'Matched by current search rules.'}</strong></span>
                  </div>
                  {selectedMapDonor.scheduleAllowed ? (
                    <Link
                      className="mt-3 inline-flex rounded-xl bg-primary px-3 py-2 text-xs font-black text-white"
                      to={`/hospital/appointments?donorId=${selectedMapDonor.id}${contextRequest ? `&requestId=${contextRequest.id}&requestReference=${encodeURIComponent(contextRequest.requestReference)}` : ''}`}
                    >
                      Schedule Appointment
                    </Link>
                  ) : (
                    <p className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs font-bold text-slate-600">
                      Contact actions disabled until eligible and available.
                    </p>
                  )}
                </div>
              ) : null}
            </div>
          )}
        </div>

        <aside className="card space-y-3">
          <h2 className="text-lg font-bold text-primary">Locator Rules</h2>
          <Rule text="Public users cannot access donor markers or donor contact data." />
          <Rule text="Only approved, active donors with confirmed blood groups appear in normal matching." />
          <Rule text="Exact donor coordinates are rounded before map display." />
          <Rule text="Cooldown and deferred donors cannot be contacted or scheduled from this locator." />
          <Rule text="Donor location information is restricted to authorized hospital staff and used only for donation coordination and emergency response. Exact coordinates and sensitive health information are not publicly displayed." />
          {summary?.radiusFallback.applied ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
              Radius fallback active: nearest donors are shown outside {summary.radiusFallback.requestedRadiusKm}km.
            </div>
          ) : null}
        </aside>
      </div>

      <FilterBox
        label="Filter results (debounced)"
        placeholder="Filter by donor name, donor reference, location, center, or blood group"
        value={searchInput}
        onChange={setSearchInput}
      />

      <div className="grid gap-3">
        {filteredResults.length === 0 ? (
          <div className="card text-sm text-muted">
            {loading
              ? 'Searching for compatible donors...'
              : results.length > 0
                ? 'No donors match the text filter.'
                : approvedAvailableFilter
                  ? "No approved and available donors currently match this hospital's scope."
                  : 'No eligible donors were found within the selected radius.'}
          </div>
        ) : (
          pagedResults.map((donor) => <DonorResultCard key={donor.id} donor={donor} />)
        )}
        {filteredResults.length > pageSize ? (
          <Pager
            page={Math.min(page, Math.max(0, totalPages - 1))}
            hasMore={page + 1 < totalPages}
            onPrev={() => setPage((value) => Math.max(0, value - 1))}
            onNext={() => setPage((value) => value + 1)}
          />
        ) : null}
      </div>
    </section>
  );
}

function Metric({ label, value, helper }: { label: string; value: number; helper: string }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm" title={helper}>
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-primary">{value}</p>
      <p className="mt-1 text-xs text-muted">{helper}</p>
    </div>
  );
}

function Rule({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{text}</p>;
}

function MapLegend({ markerTypes }: { markerTypes: string[] }) {
  if (markerTypes.length === 0) return null;
  return (
    <div className="absolute bottom-4 left-4 z-[500] max-w-[calc(100%-2rem)] rounded-xl border border-slate-200 bg-white/95 p-3 text-xs font-semibold text-slate-800 shadow-lg dark:border-slate-700 dark:bg-slate-900/95 dark:text-slate-100" aria-label="Donor map marker legend">
      <p className="mb-2 text-[11px] font-black uppercase tracking-wide text-slate-500 dark:text-slate-300">Map Legend</p>
      <div className="grid gap-2">
        {markerTypes.map((type) => {
          const color = type === 'ORIGIN' ? '#3b82f6' : type === 'STALE' ? '#d97706' : markerColors[type] ?? '#94a3b8';
          return (
            <div key={type} className="flex items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full ring-2 ring-white dark:ring-slate-900" style={{ backgroundColor: color }} aria-hidden="true" />
              <span>{markerLabels[type] ?? type}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function DonorResultCard({ donor }: { donor: DonorMatch }) {
  const disabledReason = donor.operationalStatus === 'DEFERRED'
    ? `Deferred${donor.temporaryDeferralDuration ? `: ${donor.temporaryDeferralDuration}` : ''}`
    : donor.operationalStatus?.startsWith('COOLDOWN')
      ? `Available after ${formatDate(donor.nextEligibilityDate)}`
      : 'Not available for contact';

  return (
    <article className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-lg font-black text-navy">{donor.fullName}</h3>
            <span className={`rounded-full px-3 py-1 text-xs font-black ring-1 ${statusStyles[donor.operationalStatus ?? 'UNAVAILABLE']}`}>
              {statusLabel(donor.operationalStatus)}
            </span>
            <span className={`rounded-full px-3 py-1 text-xs font-black ${donor.matchType === 'EXACT' ? 'bg-red-50 text-primary' : 'bg-blue-50 text-blue-700'}`}>
              {donor.matchType === 'EXACT' ? 'Exact' : 'Compatible'}
            </span>
          </div>
          <p className="mt-1 text-sm text-muted">{donor.donorNumber ?? 'No donor reference'} - {formatBloodGroup(donor.bloodGroup)}</p>
        </div>
        <div className="text-right text-sm font-semibold text-slate-700">
          {distanceLabel(donor)}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Location" value={[donor.areaCommunity, donor.city, donor.region].filter(Boolean).join(', ') || donor.location} />
        <Info label="Last donation" value={formatDate(donor.lastDonationDate)} />
        <Info label="Next eligible" value={formatDate(donor.nextEligibilityDate)} />
        <Info label="Last location update" value={locationFreshnessLabel(donor)} />
        <Info label="Previous donations" value={String(donor.previousDonationCount ?? donor.donationHistory?.length ?? 0)} />
        <Info label="Preferred center" value={donor.preferredHospital?.hospitalName ?? 'Not selected'} />
        <Info label="Response rate" value={donor.responseRateLabel ?? 'Not enough data'} />
        <Info label="Secure location" value={donor.mapLocationAvailable ? 'Location available' : donor.locationSharingEnabled ? 'Coordinates missing' : 'Not shared'} />
        <Info label="Contact" value={donor.contactAllowed ? donor.phone ?? donor.emergencyContactPhone ?? 'No phone listed' : disabledReason} />
      </div>

      <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50/60 p-3">
        <p className="text-xs font-black uppercase tracking-wide text-blue-700">Why this donor matches</p>
        <p className="mt-1 text-sm font-semibold text-slate-800">{donor.matchReasonSummary ?? 'Matched by the current blood group, eligibility, availability, and location filters.'}</p>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          disabled
          className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-400"
          title="Direct donor alert is sent through emergency request broadcasting."
        >
          Send Alert
        </button>
        {donor.scheduleAllowed ? (
          <Link className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-primary" to={`/hospital/appointments?donorId=${donor.id}`}>
            Schedule Appointment
          </Link>
        ) : (
          <button type="button" disabled className="rounded-xl bg-gray-100 px-4 py-2 text-sm font-bold text-gray-400">
            Schedule Appointment
          </button>
        )}
        <Link className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700" to={`/hospital/emergency-requests?bloodGroup=${donor.bloodGroup}`}>
          Create Emergency Request
        </Link>
      </div>
    </article>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-slate-50 p-3">
      <p className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-words text-sm font-semibold text-slate-800">{value}</p>
    </div>
  );
}
