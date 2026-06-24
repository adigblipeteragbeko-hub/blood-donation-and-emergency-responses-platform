import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  BloodGroup,
  BloodRequestItem,
  getHospitalRequestHistory,
} from '../services/hospital-portal';
import { bloodGroups } from '../constants/blood-groups';
import { FilterBox, Pager } from '../components/TableControls';

type HistoryFilter = 'ALL' | 'FULFILLED' | 'CANCELLED' | 'MY_REQUESTS' | 'MY_RESPONSES';

const formatBloodGroup = (value: string) => bloodGroups.find((group) => group.value === value)?.label ?? value;
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : 'N/A');
const formatSource = (source: string) =>
  source === 'DONORS_ONLY' ? 'Donors Only' : source === 'HOSPITALS_ONLY' ? 'Hospitals Only' : 'Donors + Hospitals';

function StatusBadge({ value }: { value: string }) {
  const tone =
    value === 'FULFILLED' || value === 'RECEIVED' || value === 'ACCEPTED'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : value === 'CANCELLED' || value === 'REJECTED'
        ? 'border-red-200 bg-red-50 text-red-700'
        : value === 'DISPATCHED'
          ? 'border-amber-200 bg-amber-50 text-amber-700'
          : 'border-slate-200 bg-slate-50 text-slate-700';
  return <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase ${tone}`}>{value}</span>;
}

function finalDate(request: BloodRequestItem) {
  const receivedAt = request.hospitalTransfers?.find((transfer) => transfer.receivedAt)?.receivedAt;
  const completedUpdate = request.updates?.find((update) => update.newStatus === 'COMPLETED' || update.newStatus === 'CANCELLED');
  return receivedAt ?? completedUpdate?.createdAt ?? null;
}

function respondingHospitalNames(request: BloodRequestItem) {
  const names = new Set<string>();
  request.hospitalResponses?.forEach((response) => {
    if (response.respondingHospital?.hospitalName) names.add(response.respondingHospital.hospitalName);
  });
  request.hospitalTransfers?.forEach((transfer) => {
    if (transfer.supplyingHospital?.hospitalName) names.add(transfer.supplyingHospital.hospitalName);
  });
  return Array.from(names);
}

function transferSummary(request: BloodRequestItem) {
  const transfer = request.hospitalTransfers?.[0] ?? request.hospitalResponses?.find((response) => response.transfer)?.transfer;
  const response = request.hospitalResponses?.find((item) => item.transfer?.id === transfer?.id) ?? request.hospitalResponses?.[0];
  if (!response && !transfer) return null;

  const supplier = transfer?.supplyingHospital?.hospitalName ?? response?.respondingHospital?.hospitalName ?? 'Responding hospital';
  const receiver = transfer?.receivingHospital?.hospitalName ?? request.hospital?.hospitalName ?? 'Requesting hospital';
  const units = transfer?.receivedUnits ?? transfer?.dispatchedUnits ?? transfer?.units ?? response?.unitsOffered ?? 0;

  return {
    offerStatus: response?.status ?? 'N/A',
    transferStatus: transfer?.status ?? 'N/A',
    dispatchedAt: transfer?.dispatchedAt ?? null,
    receivedAt: transfer?.receivedAt ?? null,
    units,
    supplier,
    receiver,
  };
}

export default function HospitalRequestHistoryPage() {
  const [items, setItems] = useState<BloodRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [filter, setFilter] = useState<HistoryFilter>('ALL');
  const [bloodGroup, setBloodGroup] = useState<BloodGroup | 'ALL'>('ALL');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const pageSize = 25;

  const load = async (nextPage = page) => {
    setLoading(true);
    setMessage('');
    try {
      const data = await getHospitalRequestHistory({ skip: nextPage * pageSize, take: pageSize });
      setItems(data);
      setHasMore(data.length === pageSize);
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to load request history.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 250);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (filter === 'FULFILLED' && item.status !== 'FULFILLED') return false;
        if (filter === 'CANCELLED' && item.status !== 'CANCELLED') return false;
        if (filter === 'MY_REQUESTS' && !item.isOwnRequest) return false;
        if (filter === 'MY_RESPONSES' && !item.currentHospitalResponse) return false;
        if (bloodGroup !== 'ALL' && item.bloodGroup !== bloodGroup) return false;

        const createdAt = new Date(item.createdAt).getTime();
        if (dateFrom && createdAt < new Date(`${dateFrom}T00:00:00`).getTime()) return false;
        if (dateTo && createdAt > new Date(`${dateTo}T23:59:59`).getTime()) return false;

        if (!searchTerm) return true;
        const haystack = [
          item.requestReference,
          item.bloodGroup,
          item.status,
          item.priority,
          item.requestSource,
          item.ward,
          item.location,
          item.city,
          item.region,
          item.hospital?.hospitalName,
          ...respondingHospitalNames(item),
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase();
        return haystack.includes(searchTerm);
      }),
    [bloodGroup, dateFrom, dateTo, filter, items, searchTerm],
  );

  return (
    <section className="space-y-5">
      <div className="card flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.25em] text-red-600">Hospital Archive</p>
          <h1 className="text-2xl font-bold text-primary">Request History</h1>
          <p className="text-sm text-muted">Review completed, fulfilled, cancelled, and transfer-backed blood requests.</p>
        </div>
        <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700" type="button" onClick={() => window.print()}>
          Export / Print History
        </button>
      </div>

      <div className="grid gap-3 lg:grid-cols-[1.2fr_0.8fr]">
        <FilterBox
          label="Search history"
          placeholder="Search reference, hospital, blood group, ward, location..."
          value={searchInput}
          onChange={setSearchInput}
        />
        <div className="card grid gap-3 sm:grid-cols-2">
          <select className="legacy-input" value={filter} onChange={(event) => setFilter(event.target.value as HistoryFilter)}>
            <option value="ALL">All</option>
            <option value="FULFILLED">Fulfilled</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="MY_REQUESTS">My Requests</option>
            <option value="MY_RESPONSES">Responses From My Hospital</option>
          </select>
          <select className="legacy-input" value={bloodGroup} onChange={(event) => setBloodGroup(event.target.value as BloodGroup | 'ALL')}>
            <option value="ALL">All blood groups</option>
            {bloodGroups
              .filter((group) => group.value !== 'UNKNOWN')
              .map((group) => (
                <option key={group.value} value={group.value}>
                  {group.label}
                </option>
              ))}
          </select>
          <input className="legacy-input" type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} />
          <input className="legacy-input" type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} />
        </div>
      </div>

      {message ? <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p> : null}

      <div className="card">
        {loading ? <p className="text-sm text-muted">Loading request history...</p> : null}
        {!loading && filteredItems.length === 0 ? (
          <p className="text-sm text-muted">No completed or cancelled hospital request history matches this view.</p>
        ) : null}
        {!loading && filteredItems.length > 0 ? (
          <div className="space-y-4">
            {filteredItems.map((request) => {
              const transfer = transferSummary(request);
              const responders = respondingHospitalNames(request);
              return (
                <article key={request.id} className="rounded-2xl border border-slate-200 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h2 className="text-lg font-bold text-slate-900">{request.requestReference}</h2>
                        <StatusBadge value={request.status} />
                        <StatusBadge value={request.trackingStatus} />
                      </div>
                      <p className="mt-1 text-sm text-muted">
                        {formatBloodGroup(request.bloodGroup)} - {request.unitsNeeded} unit(s) - {request.priority} priority
                      </p>
                    </div>
                    <Link className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700" to={`/hospital/active-requests?requestId=${request.id}`}>
                      View Details
                    </Link>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Requesting Hospital</p>
                      <p className="font-semibold text-slate-900">{request.hospital?.hospitalName ?? 'N/A'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Responding Hospital</p>
                      <p className="font-semibold text-slate-900">{responders.join(', ') || 'No hospital response'}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Request Source</p>
                      <p className="font-semibold text-slate-900">{formatSource(request.requestSource)}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs font-bold uppercase text-slate-500">Final Date</p>
                      <p className="font-semibold text-slate-900">{formatDate(finalDate(request))}</p>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 p-3 text-sm">
                      <p><span className="font-bold">Ward / Unit:</span> {request.ward || 'N/A'}</p>
                      <p><span className="font-bold">Location:</span> {[request.location, request.city, request.region].filter(Boolean).join(', ') || 'N/A'}</p>
                      <p><span className="font-bold">Created:</span> {formatDate(request.createdAt)}</p>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3 text-sm">
                      {transfer ? (
                        <>
                          <p><span className="font-bold">Offer:</span> {transfer.offerStatus}</p>
                          <p><span className="font-bold">Transfer:</span> {transfer.transferStatus}</p>
                          <p><span className="font-bold">Dispatched:</span> {formatDate(transfer.dispatchedAt)}</p>
                          <p><span className="font-bold">Received:</span> {formatDate(transfer.receivedAt)}</p>
                          <p className="mt-2 font-semibold text-emerald-700">
                            Inventory: {transfer.supplier} -{transfer.units}, {transfer.receiver} +{transfer.units}
                          </p>
                        </>
                      ) : (
                        <p className="text-muted">No hospital-to-hospital transfer recorded.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>

      <Pager page={page} hasMore={hasMore} onPrev={() => setPage((value) => Math.max(0, value - 1))} onNext={() => setPage((value) => value + 1)} />
    </section>
  );
}
