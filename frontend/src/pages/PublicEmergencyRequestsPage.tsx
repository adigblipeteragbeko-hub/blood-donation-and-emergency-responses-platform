import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import { unwrapApiResponse } from '../utils/api-response';

type PublicEmergencyRequest = {
  id: string;
  bloodGroup: string;
  unitsNeeded: number;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  status: string;
  trackingStatus: string;
  requestDate: string;
  neededBy: string;
  lastUpdated: string;
  publicMessage: string;
  hospital: {
    name: string;
    location: string;
    address: string;
    contactPhone: string;
  };
  acceptedResponses: number;
};

const urgencyLabelMap: Record<PublicEmergencyRequest['priority'], string> = {
  LOW: 'Standard',
  MEDIUM: 'Standard',
  HIGH: 'High',
  CRITICAL: 'Critical',
};

const formatBloodGroup = (value: string) =>
  value
    .replace('_POS', '+')
    .replace('_NEG', '-')
    .replace('_', ' ');

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });

export default function PublicEmergencyRequestsPage() {
  const [search, setSearch] = useState('');
  const [bloodType, setBloodType] = useState('all');
  const [urgency, setUrgency] = useState('all');
  const [location, setLocation] = useState('all');
  const [requests, setRequests] = useState<PublicEmergencyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadRequests = async () => {
      try {
        if (isMounted && requests.length === 0) {
          setLoading(true);
        }

        const { data } = await api.get('/public/emergency-requests', {
          params: { take: 30 },
        });
        const nextRequests = unwrapApiResponse<PublicEmergencyRequest[]>(data);

        if (!isMounted) {
          return;
        }

        setRequests(Array.isArray(nextRequests) ? nextRequests : []);
        setError('');
        setLastSynced(new Date().toISOString());
      } catch {
        if (!isMounted) {
          return;
        }

        setError('We could not load public emergency requests right now. Please try again shortly.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadRequests();
    const interval = window.setInterval(loadRequests, 30000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [requests.length]);

  const locationOptions = useMemo(
    () => Array.from(new Set(requests.map((request) => request.hospital?.location).filter(Boolean))),
    [requests],
  );

  const bloodTypeOptions = useMemo(
    () => Array.from(new Set(requests.map((request) => formatBloodGroup(request.bloodGroup)))),
    [requests],
  );

  const filteredRequests = useMemo(() => {
    return requests.filter((request) => {
      const normalizedBloodType = formatBloodGroup(request.bloodGroup);
      const normalizedUrgency = urgencyLabelMap[request.priority];
      const haystack = [
        request.hospital?.name,
        request.hospital?.location,
        request.hospital?.address,
        normalizedBloodType,
        request.publicMessage,
      ]
        .join(' ')
        .toLowerCase();

      const matchesSearch = haystack.includes(search.toLowerCase().trim());
      const matchesBloodType = bloodType === 'all' || normalizedBloodType === bloodType;
      const matchesUrgency = urgency === 'all' || normalizedUrgency === urgency;
      const matchesLocation = location === 'all' || request.hospital?.location === location;

      return matchesSearch && matchesBloodType && matchesUrgency && matchesLocation;
    });
  }, [bloodType, location, requests, search, urgency]);

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="section-heading-wrap">
        <p className="section-kicker">Emergency Blood Requests</p>
        <h1 className="section-title">Live public urgent needs with sensitive patient details hidden</h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600">
          Search current public emergency needs by blood type, urgency, location, or hospital. This board refreshes
          automatically to help emergency response teams and voluntary donors move faster.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-red-700">Live board refresh: every 30 seconds</span>
          {lastSynced ? <span>Last updated {formatTimestamp(lastSynced)}</span> : null}
        </div>
      </div>

      <article className="public-card space-y-5">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <label className="block text-sm font-semibold text-slate-700">
            Search
            <input
              aria-label="Search emergency requests"
              className="legacy-input mt-2"
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Hospital, blood type, or location"
              value={search}
            />
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Blood Type
            <select
              aria-label="Filter by blood type"
              className="legacy-input mt-2"
              onChange={(e) => setBloodType(e.target.value)}
              value={bloodType}
            >
              <option value="all">All blood types</option>
              {bloodTypeOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Urgency
            <select
              aria-label="Filter by urgency"
              className="legacy-input mt-2"
              onChange={(e) => setUrgency(e.target.value)}
              value={urgency}
            >
              <option value="all">All urgency levels</option>
              <option value="Critical">Critical</option>
              <option value="High">High</option>
              <option value="Standard">Standard</option>
            </select>
          </label>
          <label className="block text-sm font-semibold text-slate-700">
            Location
            <select
              aria-label="Filter by location"
              className="legacy-input mt-2"
              onChange={(e) => setLocation(e.target.value)}
              value={location}
            >
              <option value="all">All locations</option>
              {locationOptions.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
        </div>
      </article>

      {error ? (
        <article className="empty-state-public">
          <h2 className="text-2xl font-bold text-slate-900">Temporary loading issue</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">{error}</p>
          <button className="btn-primary mt-6 inline-flex" onClick={() => window.location.reload()} type="button">
            Reload page
          </button>
        </article>
      ) : null}

      {loading ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <article key={`skeleton-${index}`} className="public-card border-red-200">
              <div className="skeleton-line h-4 w-24" />
              <div className="mt-4 skeleton-line h-10 w-20" />
              <div className="mt-5 skeleton-line h-4 w-40" />
              <div className="mt-3 skeleton-line h-4 w-32" />
              <div className="mt-5 space-y-3">
                <div className="skeleton-line h-4 w-full" />
                <div className="skeleton-line h-4 w-5/6" />
                <div className="skeleton-line h-4 w-2/3" />
              </div>
              <div className="mt-6 flex gap-3">
                <div className="skeleton-line h-11 w-32 rounded-full" />
                <div className="skeleton-line h-11 w-24 rounded-full" />
              </div>
            </article>
          ))}
        </div>
      ) : null}

      {!loading && !error && filteredRequests.length === 0 ? (
        <article className="empty-state-public">
          <h2 className="text-2xl font-bold text-slate-900">No active emergency requests match this filter right now.</h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Try another blood type or location, or register as a donor so you can be alerted when a compatible request
            becomes active.
          </p>
          <Link className="btn-primary mt-6 inline-flex" to="/donor-register">
            Become a Donor
          </Link>
        </article>
      ) : null}

      {!loading && !error && filteredRequests.length > 0 ? (
        <div className="grid gap-5 lg:grid-cols-3">
          {filteredRequests.map((request) => {
            const urgencyLabel = urgencyLabelMap[request.priority];

            return (
              <article key={request.id} className="public-card border-red-200">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-700">{urgencyLabel} Alert</p>
                    <h2 className="mt-2 text-2xl font-black text-slate-900">{formatBloodGroup(request.bloodGroup)}</h2>
                  </div>
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold text-red-700">{request.status}</span>
                </div>
                <p className="mt-4 text-sm font-semibold text-slate-800">{request.hospital?.name ?? 'Partner hospital'}</p>
                <p className="mt-1 text-sm text-slate-500">{request.hospital?.location ?? 'Location pending'}</p>
                <p className="mt-4 text-sm leading-6 text-slate-600">{request.publicMessage}</p>
                <div className="mt-4 grid gap-2 text-sm text-slate-600">
                  <p>
                    <span className="font-semibold text-slate-800">Units needed:</span> {request.unitsNeeded}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Needed by:</span> {formatTimestamp(request.neededBy)}
                  </p>
                  <p>
                    <span className="font-semibold text-slate-800">Accepted donors:</span> {request.acceptedResponses}
                  </p>
                </div>
                <div className="mt-6 flex gap-3">
                  <Link className="btn-primary" to="/donor-register">
                    Become a Donor
                  </Link>
                  <Link className="btn-ghost" to="/contact">
                    Contact
                  </Link>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
