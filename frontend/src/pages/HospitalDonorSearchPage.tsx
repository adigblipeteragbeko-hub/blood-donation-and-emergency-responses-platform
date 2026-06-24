import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CircleMarker, MapContainer, Popup, TileLayer, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import { confirmedBloodGroups } from '../constants/blood-groups';
import { BloodGroup, DonorLocatorResponse, DonorMatch, searchHospitalDonors } from '../services/hospital-portal';
import { FilterBox, Pager } from '../components/TableControls';
import { ENGLISH_FRIENDLY_TILE_ATTRIBUTION, ENGLISH_FRIENDLY_TILE_URL } from '../constants/map-tiles';

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

function formatBloodGroup(value?: string | null) {
  return confirmedBloodGroups.find((group) => group.value === value)?.label ?? value ?? 'Not confirmed';
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleDateString();
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
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POS');
  const [matchMode, setMatchMode] = useState<'EXACT' | 'COMPATIBLE'>('EXACT');
  const [availabilityFilter, setAvailabilityFilter] = useState<'AVAILABLE_ONLY' | 'INCLUDE_COOLDOWN' | 'INCLUDE_DEFERRED' | 'ALL_APPROVED'>('AVAILABLE_ONLY');
  const [location, setLocation] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);
  const [emergencyMode, setEmergencyMode] = useState(false);
  const [browserPosition, setBrowserPosition] = useState<[number, number] | null>(null);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<DonorMatch[]>([]);
  const [summary, setSummary] = useState<DonorLocatorResponse['summary'] | null>(null);
  const pageSize = 12;

  const submit = async (event?: FormEvent) => {
    event?.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const payload = await searchHospitalDonors({
        bloodGroup,
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
      setMessage(
        payload.summary.radiusFallback.applied
          ? `No donors were inside ${payload.summary.radiusFallback.requestedRadiusKm}km, so nearest eligible donor options are shown.`
          : `Found ${payload.summary.totalMatches} donor option(s).`,
      );
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Search failed.');
      setResults([]);
      setSummary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    void submit();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      <form className="card grid gap-3 lg:grid-cols-4" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Blood Group
          <select className="legacy-input mt-1" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}>
            {confirmedBloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Match Mode
          <select className="legacy-input mt-1" value={matchMode} onChange={(e) => setMatchMode(e.target.value as 'EXACT' | 'COMPATIBLE')}>
            <option value="EXACT">Exact Match</option>
            <option value="COMPATIBLE">Compatible Donors</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Availability
          <select className="legacy-input mt-1" value={availabilityFilter} onChange={(e) => setAvailabilityFilter(e.target.value as typeof availabilityFilter)}>
            <option value="AVAILABLE_ONLY">Available only</option>
            <option value="INCLUDE_COOLDOWN">Include cooldown</option>
            <option value="INCLUDE_DEFERRED">Include deferred</option>
            <option value="ALL_APPROVED">All approved donors</option>
          </select>
        </label>
        <label className="text-sm font-semibold">
          Radius (km)
          <input className="legacy-input mt-1" min={1} max={300} type="number" value={radiusKm} onChange={(e) => setRadiusKm(Number(e.target.value))} />
        </label>
        <label className="text-sm font-semibold lg:col-span-2">
          City / Location
          <input className="legacy-input mt-1" type="text" value={location} onChange={(e) => setLocation(e.target.value)} placeholder="Leave blank to use hospital location" />
        </label>
        <label className="flex items-center gap-3 rounded-2xl border border-red-100 px-4 py-3 text-sm font-semibold">
          <input type="checkbox" checked={emergencyMode} onChange={(event) => setEmergencyMode(event.target.checked)} />
          Emergency mode
        </label>
        <div className="flex flex-wrap gap-2">
          <button className="btn-secondary" type="button" onClick={locateBrowser}>Use Browser Location</button>
          <button className="btn-primary" disabled={loading} type="submit">{loading ? 'Searching...' : 'Search Donors'}</button>
        </div>
      </form>

      {message ? <p className="rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-semibold text-primary">{message}</p> : null}

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Visible matches" value={summary?.totalMatches ?? results.length} />
        <Metric label="Available" value={summary?.availableCount ?? 0} />
        <Metric label="Cooldown" value={summary?.cooldownCount ?? 0} />
        <Metric label="Map ready" value={summary?.mapReadyCount ?? mapDonors.length} />
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="card overflow-hidden p-0">
          <div className="border-b border-gray-100 p-4">
            <h2 className="text-lg font-bold text-primary">Secure Donor Map</h2>
            <p className="text-sm text-muted">Approximate donor markers appear only when secure location sharing is enabled.</p>
          </div>
          {mapDonors.length === 0 ? (
            <div className="flex h-[420px] items-center justify-center p-6 text-center text-sm text-muted">
              No map-ready donors found. Donors must be approved, have confirmed blood group, and enable secure location sharing.
            </div>
          ) : (
            <MapContainer className="h-[420px] w-full xl:h-[520px]" center={mapCenter} zoom={mapCenter === ghanaCenter ? 7 : 10} scrollWheelZoom>
              <RecenterMap center={mapCenter} />
              <TileLayer attribution={ENGLISH_FRIENDLY_TILE_ATTRIBUTION} url={ENGLISH_FRIENDLY_TILE_URL} />
              {summary?.origin ? (
                <CircleMarker center={[summary.origin.latitude, summary.origin.longitude]} radius={10} pathOptions={{ color: '#1d4ed8', fillColor: '#3b82f6', fillOpacity: 0.8 }}>
                  <Popup>{summary.origin.source === 'hospital' ? `${summary.origin.hospitalName} search center` : 'Browser search center'}</Popup>
                </CircleMarker>
              ) : null}
              {mapDonors.map((donor) => (
                <CircleMarker
                  key={donor.id}
                  center={[donor.latitude!, donor.longitude!]}
                  radius={9}
                  pathOptions={{
                    color: markerColors[donor.operationalStatus ?? 'UNAVAILABLE'],
                    fillColor: markerColors[donor.operationalStatus ?? 'UNAVAILABLE'],
                    fillOpacity: 0.82,
                  }}
                >
                  <Popup>
                    <strong>{donor.fullName}</strong><br />
                    {donor.donorNumber ?? 'No donor reference'} - {formatBloodGroup(donor.bloodGroup)}<br />
                    Status: {statusLabel(donor.operationalStatus)}<br />
                    Last donation: {formatDate(donor.lastDonationDate)}<br />
                    Next eligible: {formatDate(donor.nextEligibilityDate)}<br />
                    {donor.distanceKm !== null && donor.distanceKm !== undefined ? `${donor.distanceKm} km away` : 'Distance unavailable'}<br />
                    Preferred center: {donor.preferredHospital?.hospitalName ?? 'Not selected'}<br />
                    {donor.scheduleAllowed ? 'Schedule appointment from result card.' : `Available after ${formatDate(donor.nextEligibilityDate)}`}
                  </Popup>
                </CircleMarker>
              ))}
            </MapContainer>
          )}
        </div>

        <aside className="card space-y-3">
          <h2 className="text-lg font-bold text-primary">Locator Rules</h2>
          <Rule text="Public users cannot access donor markers or donor contact data." />
          <Rule text="Only approved, active donors with confirmed blood groups appear in normal matching." />
          <Rule text="Exact donor coordinates are rounded before map display." />
          <Rule text="Cooldown and deferred donors cannot be contacted or scheduled from this locator." />
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
          <div className="card text-sm text-muted">No donors matched this search. Try compatible mode, include cooldown, or widen the radius.</div>
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

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wide text-muted">{label}</p>
      <p className="mt-1 text-2xl font-black text-primary">{value}</p>
    </div>
  );
}

function Rule({ text }: { text: string }) {
  return <p className="rounded-2xl bg-slate-50 p-3 text-sm text-slate-700">{text}</p>;
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
          {donor.distanceKm !== null && donor.distanceKm !== undefined ? `${donor.distanceKm} km away` : 'Distance unavailable'}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Info label="Location" value={[donor.areaCommunity, donor.city, donor.region].filter(Boolean).join(', ') || donor.location} />
        <Info label="Last donation" value={formatDate(donor.lastDonationDate)} />
        <Info label="Next eligible" value={formatDate(donor.nextEligibilityDate)} />
        <Info label="Previous donations" value={String(donor.previousDonationCount ?? donor.donationHistory?.length ?? 0)} />
        <Info label="Preferred center" value={donor.preferredHospital?.hospitalName ?? 'Not selected'} />
        <Info label="Response rate" value={donor.responseRateLabel ?? 'Not enough data'} />
        <Info label="Secure location" value={donor.mapLocationAvailable ? 'Map ready' : donor.locationSharingEnabled ? 'Coordinates missing' : 'Not shared'} />
        <Info label="Contact" value={donor.contactAllowed ? donor.phone ?? donor.emergencyContactPhone ?? 'No phone listed' : disabledReason} />
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
