import { useEffect, useMemo, useState } from 'react';
import { getPublicWebsiteContent, PartnerHospitalItem } from '../services/website-management';

type PublicCenter = PartnerHospitalItem & {
  address: string;
  contactPhone: string;
  mapsUrl: string;
};

const buildEmbedUrl = (center: PublicCenter) => {
  if (center.latitude !== null && center.longitude !== null) {
    return `https://www.google.com/maps?q=${center.latitude},${center.longitude}&z=13&output=embed`;
  }

  return `https://www.google.com/maps?q=${encodeURIComponent(
    `${center.hospitalName} ${center.address} ${center.location}`,
  )}&output=embed`;
};

export default function NearbyCentersPage() {
  const [centers, setCenters] = useState<PublicCenter[]>([]);
  const [selectedCenterId, setSelectedCenterId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    const loadCenters = async () => {
      try {
        if (isMounted && centers.length === 0) {
          setLoading(true);
        }

        const content = await getPublicWebsiteContent();
        const data: PublicCenter[] = content.partnerHospitals.map((hospital) => ({
          ...hospital,
          address: hospital.location,
          contactPhone: hospital.phone,
          mapsUrl:
            hospital.latitude !== null && hospital.longitude !== null
              ? `https://www.google.com/maps?q=${hospital.latitude},${hospital.longitude}`
              : `https://www.google.com/maps?q=${encodeURIComponent(
                  `${hospital.hospitalName} ${hospital.location}`,
                )}`,
        }));

        if (!isMounted) {
          return;
        }

        setCenters(data);
        setSelectedCenterId((current) => current ?? data[0]?.id ?? null);
        setError('');
        setLastSynced(new Date().toISOString());
      } catch {
        if (!isMounted) {
          return;
        }

        setError('We could not load partner hospitals right now. Please try again shortly.');
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    loadCenters();
    const interval = window.setInterval(loadCenters, 45000);

    return () => {
      isMounted = false;
      window.clearInterval(interval);
    };
  }, [centers.length]);

  const filteredCenters = useMemo(() => {
    const normalizedSearch = search.toLowerCase().trim();
    if (!normalizedSearch) {
      return centers;
    }

    return centers.filter((center) =>
      [center.hospitalName, center.location, center.address, center.contactPhone, center.email]
        .join(' ')
        .toLowerCase()
        .includes(normalizedSearch),
    );
  }, [centers, search]);

  const selectedCenter = filteredCenters.find((center) => center.id === selectedCenterId) ?? filteredCenters[0] ?? null;

  useEffect(() => {
    if (selectedCenter) {
      setSelectedCenterId(selectedCenter.id);
    }
  }, [selectedCenter]);

  return (
    <section className="mx-auto max-w-6xl space-y-8">
      <div className="section-heading-wrap">
        <p className="section-kicker">Nearby Blood Centers / Hospitals</p>
        <h1 className="section-title">Find partner hospitals and open directions quickly</h1>
        <p className="max-w-3xl text-sm leading-7 text-slate-600">
          This center directory now reads live hospital data from the platform and presents a map-ready view for donor
          travel planning and emergency support.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
          <span className="rounded-full border border-red-200 bg-red-50 px-3 py-2 text-red-700">
            Map-enabled center lookup
          </span>
          {lastSynced ? (
            <span>
              Last refreshed{' '}
              {new Date(lastSynced).toLocaleString([], {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </span>
          ) : null}
        </div>
      </div>

      <div className="public-map-shell">
        <div className="space-y-5">
          <label className="block text-sm font-semibold text-slate-700">
            Search hospitals or areas
            <input
              className="legacy-input mt-2"
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by hospital, location, phone, or email"
              value={search}
            />
          </label>

          {error ? (
            <article className="rounded-[24px] border border-red-200 bg-red-50 px-5 py-4 text-sm font-medium text-red-700">
              {error}
            </article>
          ) : null}

          {loading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {Array.from({ length: 4 }).map((_, index) => (
                <article key={`center-skeleton-${index}`} className="public-card bg-white">
                  <div className="skeleton-line h-4 w-20" />
                  <div className="mt-3 skeleton-line h-6 w-3/4" />
                  <div className="mt-3 skeleton-line h-4 w-1/2" />
                  <div className="mt-3 skeleton-line h-4 w-full" />
                  <div className="mt-2 skeleton-line h-4 w-2/3" />
                </article>
              ))}
            </div>
          ) : null}

          {!loading && !error && filteredCenters.length === 0 ? (
            <article className="empty-state-public !p-6">
              <h2 className="text-xl font-bold text-slate-900">No matching hospitals found</h2>
              <p className="mt-2 text-sm leading-7 text-slate-600">
                Try another area, hospital name, or contact detail to locate the nearest partner center.
              </p>
            </article>
          ) : null}

          {!loading && !error && filteredCenters.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {filteredCenters.map((center) => (
                <button
                  key={center.id}
                  className={`public-card bg-white text-left ${
                    selectedCenter?.id === center.id ? 'ring-2 ring-red-300' : ''
                  }`}
                  onClick={() => setSelectedCenterId(center.id)}
                  type="button"
                >
                  <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-700">{center.location}</p>
                  <h3 className="mt-2 text-lg font-bold text-slate-900">{center.hospitalName}</h3>
                  <p className="mt-2 text-sm font-medium text-slate-700">{center.address}</p>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{center.contactPhone}</p>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="space-y-4 rounded-[28px] border border-red-100 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-red-700">Selected Center</p>
              <h2 className="mt-2 text-2xl font-black text-slate-900">
                {selectedCenter?.hospitalName ?? 'Waiting for center data'}
              </h2>
            </div>
            {selectedCenter ? (
              <a className="btn-primary" href={selectedCenter.mapsUrl} rel="noreferrer" target="_blank">
                Open in Maps
              </a>
            ) : null}
          </div>

          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-slate-50">
            {selectedCenter ? (
              <iframe
                className="h-[320px] w-full"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                src={buildEmbedUrl(selectedCenter)}
                title={`Map of ${selectedCenter.hospitalName}`}
              />
            ) : (
              <div className="flex h-[320px] items-center justify-center text-sm font-medium text-slate-500">
                Select a hospital to preview directions.
              </div>
            )}
          </div>

          {selectedCenter ? (
            <div className="grid gap-4 md:grid-cols-2">
              <article className="rounded-[20px] border border-red-100 bg-red-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-700">Address</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedCenter.address}</p>
              </article>
              <article className="rounded-[20px] border border-red-100 bg-red-50 px-5 py-4">
                <p className="text-xs font-bold uppercase tracking-[0.22em] text-red-700">Contact</p>
                <p className="mt-2 text-sm leading-6 text-slate-700">{selectedCenter.contactPhone}</p>
                <p className="mt-1 text-sm leading-6 text-slate-700">{selectedCenter.email}</p>
              </article>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
