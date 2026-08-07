import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BloodRequestItem,
  HospitalRequestResponseItem,
  HospitalRequestResponseStatus,
  RequestStatus,
  dispatchHospitalBloodTransfer,
  getHospitalActiveRequestById,
  getHospitalActiveRequests,
  receiveHospitalBloodTransfer,
  respondToHospitalActiveRequest,
  cancelHospitalActiveRequest,
  updateHospitalActiveRequest,
  updateHospitalActiveResponseStatus,
} from '../services/hospital-portal';
import { bloodGroups } from '../constants/blood-groups';
import { FilterBox, Pager } from '../components/TableControls';

const activeStatuses: RequestStatus[] = ['OPEN', 'MATCHING'];
const responseStatusOptions: HospitalRequestResponseStatus[] = ['ACCEPTED', 'REJECTED', 'CANCELLED'];

const formatBloodGroup = (value: string) => bloodGroups.find((group) => group.value === value)?.label ?? value;
const formatDate = (value?: string | null) => (value ? new Date(value).toLocaleString() : 'N/A');
const formatSource = (source: string) =>
  source === 'DONORS_ONLY' ? 'Donors Only' : source === 'HOSPITALS_ONLY' ? 'Hospitals Only' : 'Donors + Hospitals';

const isHospitalSource = (source: string) => source === 'HOSPITALS_ONLY' || source === 'DONORS_AND_HOSPITALS';

type RequestEditDraft = {
  ward: string;
  unitsNeeded: string;
  priority: BloodRequestItem['priority'];
  requestSource: BloodRequestItem['requestSource'];
  location: string;
  city: string;
  region: string;
  requiredBy: string;
  notes: string;
  cancelReason: string;
};

const toDateTimeInput = (value?: string | null) => {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString().slice(0, 16);
};

const makeEditDraft = (request: BloodRequestItem): RequestEditDraft => ({
  ward: request.ward ?? '',
  unitsNeeded: String(request.unitsNeeded ?? 1),
  priority: request.priority,
  requestSource: request.requestSource,
  location: request.location ?? '',
  city: request.city ?? '',
  region: request.region ?? '',
  requiredBy: toDateTimeInput(request.requiredBy),
  notes: request.notes ?? '',
  cancelReason: '',
});

function getFulfillmentProgress(request: BloodRequestItem) {
  const transferMap = new Map<string, NonNullable<HospitalRequestResponseItem['transfer']>>();
  request.hospitalTransfers?.forEach((transfer) => {
    transferMap.set(transfer.id, transfer);
  });
  request.hospitalResponses?.forEach((response) => {
    if (response.transfer) {
      transferMap.set(response.transfer.id, response.transfer);
    }
  });

  const receivedUnits = Array.from(transferMap.values()).reduce((sum, transfer) => sum + Number(transfer.receivedUnits ?? 0), 0);
  const requestedUnits = Number(request.unitsNeeded ?? 0);
  const remainingUnits = Math.max(requestedUnits - receivedUnits, 0);

  return {
    requestedUnits,
    receivedUnits,
    remainingUnits,
    isFulfilled: requestedUnits > 0 && receivedUnits >= requestedUnits,
    isPartial: receivedUnits > 0 && receivedUnits < requestedUnits,
  };
}

function TransferFulfillmentSummary({ request }: { request: BloodRequestItem }) {
  const progress = getFulfillmentProgress(request);
  return (
    <div className="mt-3 rounded-xl border border-amber-100 bg-amber-50/60 p-3 text-sm">
      <p className="font-bold text-slate-900">
        {progress.isFulfilled ? 'Request fulfilled' : progress.isPartial ? 'Partial fulfillment' : 'Awaiting fulfillment'}
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        <p>
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Requested</span>
          {progress.requestedUnits} unit(s)
        </p>
        <p>
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Received</span>
          {progress.receivedUnits} unit(s)
        </p>
        <p>
          <span className="block text-xs font-bold uppercase tracking-wide text-slate-500">Remaining</span>
          {progress.remainingUnits} unit(s)
        </p>
      </div>
    </div>
  );
}

function StatusBadge({ children, tone = 'slate' }: { children: string; tone?: 'red' | 'amber' | 'green' | 'slate' }) {
  const classes = {
    red: 'border-red-200 bg-red-50 text-red-700',
    amber: 'border-amber-200 bg-amber-50 text-amber-700',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    slate: 'border-slate-200 bg-slate-50 text-slate-700',
  };
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-wide ${classes[tone]}`}>
      {children}
    </span>
  );
}

export default function HospitalActiveRequestsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const focusRequestId = searchParams.get('requestId') ?? '';
  const activeFilter = searchParams.get('filter') === 'active';
  const detailRef = useRef<HTMLDivElement | null>(null);
  const [items, setItems] = useState<BloodRequestItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [offerUnits, setOfferUnits] = useState('1');
  const [offerNote, setOfferNote] = useState('');
  const [cannotFulfillNote, setCannotFulfillNote] = useState('');
  const [dispatchDrafts, setDispatchDrafts] = useState<Record<string, { units: string; note: string; reference: string }>>({});
  const [receiveDrafts, setReceiveDrafts] = useState<Record<string, { units: string; note: string; condition: string }>>({});
  const [editDraft, setEditDraft] = useState<RequestEditDraft | null>(null);
  const [editing, setEditing] = useState(false);
  const pageSize = 25;

  const load = async (nextPage = page) => {
    setLoading(true);
    try {
      const data = await getHospitalActiveRequests({ skip: nextPage * pageSize, take: pageSize });
      setItems(data);
      setHasMore(data.length === pageSize);
      if (focusRequestId && !selectedRequest) {
        const match = data.find((item) => item.id === focusRequestId);
        if (match) setSelectedRequest(match);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to load active requests.');
    } finally {
      setLoading(false);
    }
  };

  const loadDetail = async (id: string) => {
    setDetailLoading(true);
    setMessage('');
    try {
      const data = await getHospitalActiveRequestById(id);
      setSelectedRequest(data);
      setSearchParams({ requestId: id });
      window.setTimeout(() => detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 80);
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to load request details.');
    } finally {
      setDetailLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  useEffect(() => {
    if (focusRequestId) void loadDetail(focusRequestId);
  }, [focusRequestId]);

  useEffect(() => {
    const timer = window.setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !searchTerm ||
          item.bloodGroup.toLowerCase().includes(searchTerm) ||
          item.requestReference.toLowerCase().includes(searchTerm) ||
          item.priority.toLowerCase().includes(searchTerm) ||
          item.status.toLowerCase().includes(searchTerm) ||
          item.trackingStatus.toLowerCase().includes(searchTerm) ||
          item.requestSource.toLowerCase().includes(searchTerm) ||
          item.location.toLowerCase().includes(searchTerm) ||
          (item.hospital?.hospitalName ?? '').toLowerCase().includes(searchTerm),
      ),
    [items, searchTerm],
  );

  const refreshSelected = async () => {
    await load();
    if (selectedRequest) await loadDetail(selectedRequest.id);
  };

  const submitOffer = async () => {
    if (!selectedRequest) return;
    const units = Number(offerUnits);
    if (!Number.isFinite(units) || units < 1) {
      setMessage('Offer at least 1 unit.');
      return;
    }
    if (selectedRequest.currentHospitalStock && units > selectedRequest.currentHospitalStock.availableUnits) {
      setMessage(`Cannot offer more than available stock (${selectedRequest.currentHospitalStock.availableUnits} unit(s)).`);
      return;
    }
    try {
      await respondToHospitalActiveRequest(selectedRequest.id, {
        responseType: 'OFFERED',
        unitsOffered: units,
        bloodGroupOffered: selectedRequest.bloodGroup,
        note: offerNote.trim() || undefined,
      });
      setMessage('Offer submitted to requesting hospital.');
      await refreshSelected();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to submit offer.');
    }
  };

  const submitCannotFulfill = async () => {
    if (!selectedRequest) return;
    if (!cannotFulfillNote.trim()) {
      setMessage('Enter a reason before marking this request as unable to fulfil.');
      return;
    }
    try {
      await respondToHospitalActiveRequest(selectedRequest.id, {
        responseType: 'CANNOT_FULFILL',
        note: cannotFulfillNote.trim(),
      });
      setMessage('Your hospital marked this request as unable to fulfil.');
      await refreshSelected();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to submit response.');
    }
  };

  const updateResponseStatus = async (response: HospitalRequestResponseItem, status: HospitalRequestResponseStatus) => {
    if (!selectedRequest) return;
    try {
      await updateHospitalActiveResponseStatus(selectedRequest.id, response.id, { status });
      setMessage(`Hospital response ${status.toLowerCase()}.`);
      await refreshSelected();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to update hospital response.');
    }
  };

  const cancelRequest = async () => {
    if (!selectedRequest) return;
    try {
      await cancelHospitalActiveRequest(
        selectedRequest.id,
        {
          reason: editDraft?.cancelReason.trim() || 'Hospital cancelled this blood request.',
          lastKnownUpdatedAt: selectedRequest.updatedAt,
        },
      );
      setMessage('Request cancelled.');
      setEditDraft(null);
      await refreshSelected();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to cancel request.');
    }
  };

  const saveRequestEdits = async () => {
    if (!selectedRequest || !editDraft) return;
    const unitsNeeded = Number(editDraft.unitsNeeded);
    if (!Number.isFinite(unitsNeeded) || unitsNeeded < 1) {
      setMessage('Units requested must be at least 1.');
      return;
    }
    if (!editDraft.ward.trim()) {
      setMessage('Ward / Unit is required.');
      return;
    }
    if (!editDraft.location.trim()) {
      setMessage('Location is required.');
      return;
    }
    try {
      setEditing(true);
      const updated = await updateHospitalActiveRequest(selectedRequest.id, {
        ward: editDraft.ward.trim(),
        unitsNeeded,
        priority: editDraft.priority,
        requestSource: editDraft.requestSource,
        location: editDraft.location.trim(),
        city: editDraft.city.trim() || undefined,
        region: editDraft.region.trim() || undefined,
        requiredBy: new Date(editDraft.requiredBy).toISOString(),
        notes: editDraft.notes.trim() || undefined,
        lastKnownUpdatedAt: selectedRequest.updatedAt,
      });
      setMessage(`Request ${updated.requestReference} updated successfully.`);
      setSelectedRequest(updated);
      setEditDraft(null);
      await refreshSelected();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to update request.');
    } finally {
      setEditing(false);
    }
  };

  const dispatchTransfer = async (response: HospitalRequestResponseItem) => {
    if (!selectedRequest) return;
    const draft = dispatchDrafts[response.id] ?? { units: String(response.transfer?.units ?? response.unitsOffered ?? 1), note: '', reference: '' };
    const units = Number(draft.units);
    if (!Number.isFinite(units) || units < 1) {
      setMessage('Dispatch at least 1 unit.');
      return;
    }
    try {
      await dispatchHospitalBloodTransfer(selectedRequest.id, response.id, {
        units,
        dispatchNote: draft.note.trim() || undefined,
        dispatchReference: draft.reference.trim() || undefined,
      });
      setMessage('Blood dispatched. Supplier inventory has been reduced.');
      await refreshSelected();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to dispatch blood.');
    }
  };

  const receiveTransfer = async (response: HospitalRequestResponseItem) => {
    if (!selectedRequest) return;
    const draft = receiveDrafts[response.id] ?? { units: String(response.transfer?.dispatchedUnits ?? response.unitsOffered ?? 1), note: '', condition: '' };
    const units = Number(draft.units);
    if (!Number.isFinite(units) || units < 1) {
      setMessage('Confirm at least 1 received unit.');
      return;
    }
    try {
      await receiveHospitalBloodTransfer(selectedRequest.id, response.id, {
        units,
        receivedNote: draft.note.trim() || undefined,
        receivedCondition: draft.condition.trim() || undefined,
      });
      setMessage('Receipt confirmed. Receiving hospital inventory has been increased.');
      await refreshSelected();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to confirm receipt.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Active Requests</h1>
        <p className="text-sm text-muted">
          Coordinate open blood requests from your hospital and other hospitals seeking stock support.
        </p>
        {activeFilter ? (
          <p className="mt-2 rounded-xl border border-blue-100 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
            Showing active requests only. Active requests are open or matching requests available to this hospital.
          </p>
        ) : null}
      </div>

      <FilterBox
        label="Filter requests (debounced)"
        placeholder="Filter by blood group, hospital, status, priority, location..."
        value={searchInput}
        onChange={setSearchInput}
      />

      <div className="card">
        {loading ? <p className="text-sm text-muted">Loading requests...</p> : null}
        {!loading && filteredItems.length === 0 ? (
          <p className="text-sm text-muted">There are no active blood requests.</p>
        ) : null}
        {!loading && filteredItems.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">Reference</th>
                  <th className="px-4 py-3">Blood</th>
                  <th className="px-4 py-3">Units</th>
                  <th className="px-4 py-3">Requesting Hospital</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Required By</th>
                  <th className="px-4 py-3">Location</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => (
                  <tr key={item.id} className="border-b border-slate-100">
                    <td className="px-4 py-3 font-bold text-slate-900">{item.requestReference}</td>
                    <td className="px-4 py-3">{formatBloodGroup(item.bloodGroup)}</td>
                    <td className="px-4 py-3">{item.unitsNeeded}</td>
                    <td className="px-4 py-3">{item.hospital?.hospitalName ?? item.hospitalCenterName ?? 'N/A'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={item.priority === 'CRITICAL' || item.priority === 'HIGH' ? 'red' : 'amber'}>
                        {item.priority}
                      </StatusBadge>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge tone={activeStatuses.includes(item.status) ? 'amber' : 'slate'}>{item.status}</StatusBadge>
                    </td>
                    <td className="px-4 py-3">{formatDate(item.requiredBy)}</td>
                    <td className="px-4 py-3">{item.emergencyLocation ?? item.location}</td>
                    <td className="px-4 py-3">
                      <button className="btn-primary !px-3 !py-2 text-xs" type="button" onClick={() => void loadDetail(item.id)}>
                        View / Respond
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
        <Pager page={page} hasMore={hasMore} onPrev={() => setPage((value) => Math.max(0, value - 1))} onNext={() => setPage((value) => value + 1)} />
      </div>

      <div ref={detailRef} className="card">
        <h2 className="text-xl font-bold text-slate-900">Request Details</h2>
        {detailLoading ? <p className="mt-3 text-sm text-muted">Loading request details...</p> : null}
        {!detailLoading && !selectedRequest ? (
          <p className="mt-3 text-sm text-muted">Select an active request to view coordination details.</p>
        ) : null}
        {selectedRequest ? (
          <div className="mt-4 space-y-5">
            <div className="grid gap-3 rounded-2xl border border-red-100 bg-red-50/40 p-4 md:grid-cols-3">
              <p className="text-sm"><span className="font-semibold">Request Reference:</span> {selectedRequest.requestReference}</p>
              <p className="text-sm"><span className="font-semibold">Requesting Hospital:</span> {selectedRequest.hospital?.hospitalName ?? selectedRequest.hospitalCenterName ?? 'N/A'}</p>
              <p className="text-sm"><span className="font-semibold">Blood Group:</span> {formatBloodGroup(selectedRequest.bloodGroup)}</p>
              <p className="text-sm"><span className="font-semibold">Units Requested:</span> {selectedRequest.unitsNeeded}</p>
              <p className="text-sm"><span className="font-semibold">Priority:</span> {selectedRequest.priority}</p>
              <p className="text-sm"><span className="font-semibold">Status:</span> {selectedRequest.status}</p>
              <p className="text-sm"><span className="font-semibold">Ward / Unit:</span> {selectedRequest.ward ?? 'N/A'}</p>
              <p className="text-sm"><span className="font-semibold">Location:</span> {selectedRequest.emergencyLocation ?? selectedRequest.location}</p>
              <p className="text-sm"><span className="font-semibold">Required By:</span> {formatDate(selectedRequest.requiredBy)}</p>
              <p className="text-sm"><span className="font-semibold">Created:</span> {formatDate(selectedRequest.createdAt)}</p>
              <p className="text-sm"><span className="font-semibold">Request Source:</span> {formatSource(selectedRequest.requestSource)}</p>
              <p className="text-sm"><span className="font-semibold">Region:</span> {[selectedRequest.city, selectedRequest.region].filter(Boolean).join(', ') || 'N/A'}</p>
              <p className="text-sm md:col-span-3"><span className="font-semibold">Clinical Notes:</span> {selectedRequest.notes ?? 'N/A'}</p>
            </div>

            {selectedRequest.isOwnRequest ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-slate-900">Incoming Hospital Responses</h3>
                    <p className="text-sm text-muted">Accept or reject supply offers. Inventory transfer remains a manual dispatch step.</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <button
                      className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold"
                      type="button"
                      onClick={() => setEditDraft(makeEditDraft(selectedRequest))}
                    >
                      Edit Request
                    </button>
                    <button className="rounded-xl border border-slate-200 px-3 py-2 text-sm font-bold" type="button" onClick={() => void cancelRequest()}>
                      Cancel Request
                    </button>
                  </div>
                </div>
                {editDraft ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-slate-900">Edit request details</h4>
                        <p className="text-xs text-muted">Blood Group is locked after coordination starts. Refresh if another user updated this request.</p>
                      </div>
                      <button className="text-sm font-bold text-slate-500" type="button" onClick={() => setEditDraft(null)}>
                        Close
                      </button>
                    </div>
                    <div className="mt-3 grid gap-3 md:grid-cols-2">
                      <label className="text-sm font-semibold">
                        Ward / Unit
                        <input className="legacy-input mt-1" value={editDraft.ward} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, ward: e.target.value } : draft)} />
                      </label>
                      <label className="text-sm font-semibold">
                        Units Requested
                        <input className="legacy-input mt-1" min={1} type="number" value={editDraft.unitsNeeded} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, unitsNeeded: e.target.value } : draft)} />
                      </label>
                      <label className="text-sm font-semibold">
                        Priority
                        <select className="legacy-input mt-1" value={editDraft.priority} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, priority: e.target.value as RequestEditDraft['priority'] } : draft)}>
                          {(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const).map((priority) => <option key={priority} value={priority}>{priority}</option>)}
                        </select>
                      </label>
                      <label className="text-sm font-semibold">
                        Request Source
                        <select className="legacy-input mt-1" value={editDraft.requestSource} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, requestSource: e.target.value as RequestEditDraft['requestSource'] } : draft)}>
                          <option value="DONORS_ONLY">Donors Only</option>
                          <option value="HOSPITALS_ONLY">Hospitals Only</option>
                          <option value="DONORS_AND_HOSPITALS">Donors + Hospitals</option>
                        </select>
                      </label>
                      <label className="text-sm font-semibold">
                        Location
                        <input className="legacy-input mt-1" value={editDraft.location} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, location: e.target.value } : draft)} />
                      </label>
                      <label className="text-sm font-semibold">
                        Required By
                        <input className="legacy-input mt-1" type="datetime-local" value={editDraft.requiredBy} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, requiredBy: e.target.value } : draft)} />
                      </label>
                      <label className="text-sm font-semibold">
                        City
                        <input className="legacy-input mt-1" value={editDraft.city} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, city: e.target.value } : draft)} />
                      </label>
                      <label className="text-sm font-semibold">
                        Region
                        <input className="legacy-input mt-1" value={editDraft.region} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, region: e.target.value } : draft)} />
                      </label>
                      <label className="text-sm font-semibold md:col-span-2">
                        Notes
                        <textarea className="legacy-input mt-1 min-h-20" value={editDraft.notes} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, notes: e.target.value } : draft)} />
                      </label>
                      <label className="text-sm font-semibold md:col-span-2">
                        Cancellation Reason
                        <input className="legacy-input mt-1" value={editDraft.cancelReason} onChange={(e) => setEditDraft((draft) => draft ? { ...draft, cancelReason: e.target.value } : draft)} placeholder="Optional reason if cancelling this request" />
                      </label>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-2">
                      <button className="btn-primary !px-4 !py-2 text-sm" disabled={editing} type="button" onClick={() => void saveRequestEdits()}>
                        {editing ? 'Saving...' : 'Save Changes'}
                      </button>
                      <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700" type="button" onClick={() => void cancelRequest()}>
                        Cancel Request
                      </button>
                    </div>
                  </div>
                ) : null}
                <TransferFulfillmentSummary request={selectedRequest} />
                <div className="mt-4 space-y-3">
                  {selectedRequest.hospitalResponses?.length ? (
                    selectedRequest.hospitalResponses.map((response) => (
                      <div key={response.id} className="rounded-xl border border-slate-100 p-3">
                        <div className="grid gap-2 md:grid-cols-5">
                          <p className="text-sm font-bold">{response.respondingHospital?.hospitalName ?? 'Hospital'}</p>
                          <p className="text-sm">{response.responseType === 'OFFERED' ? `${response.unitsOffered ?? 0} unit(s)` : 'Cannot fulfill'}</p>
                          <p className="text-sm">{response.bloodGroupOffered ? formatBloodGroup(response.bloodGroupOffered) : 'N/A'}</p>
                          <p className="text-sm">{response.status}</p>
                          <p className="text-sm">{formatDate(response.createdAt)}</p>
                        </div>
                        {response.note ? <p className="mt-2 text-sm text-slate-600">{response.note}</p> : null}
                        {response.transfer ? (
                          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
                            <p className="font-bold">
                              Transfer status:{' '}
                              {response.transfer.status === 'ACCEPTED'
                                ? 'Accepted - Awaiting Dispatch'
                                : response.transfer.status === 'DISPATCHED'
                                  ? 'Dispatched - Awaiting Receipt Confirmation'
                                  : response.transfer.status === 'RECEIVED'
                                    ? `${getFulfillmentProgress(selectedRequest).receivedUnits} of ${getFulfillmentProgress(selectedRequest).requestedUnits} units fulfilled`
                                    : response.transfer.status}
                            </p>
                            <p>Accepted units: {response.transfer.units}</p>
                            {response.transfer.dispatchedUnits ? <p>Dispatched units: {response.transfer.dispatchedUnits}</p> : null}
                            {response.transfer.receivedUnits ? <p>Received units: {response.transfer.receivedUnits}</p> : null}
                            {response.transfer.dispatchedAt ? <p>Dispatched: {formatDate(response.transfer.dispatchedAt)}</p> : null}
                            {response.transfer.receivedAt ? <p>Received: {formatDate(response.transfer.receivedAt)}</p> : null}
                          </div>
                        ) : null}
                        {response.responseType === 'OFFERED' && response.status === 'PENDING' ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {responseStatusOptions.map((status) => (
                              <button
                                key={status}
                                className="rounded-xl border border-red-200 px-3 py-2 text-sm font-bold text-red-700"
                                type="button"
                                onClick={() => void updateResponseStatus(response, status)}
                              >
                                {status === 'ACCEPTED' ? 'Accept Offer' : status === 'REJECTED' ? 'Reject Offer' : 'Cancel'}
                              </button>
                            ))}
                          </div>
                        ) : null}
                        {response.responseType === 'OFFERED' && response.transfer?.status === 'DISPATCHED' ? (
                          <div className="mt-3 rounded-xl border border-emerald-100 p-3">
                            <p className="font-bold text-slate-900">Confirm Received</p>
                            <p className="text-sm text-muted">Confirm only after blood physically arrives.</p>
                            <div className="mt-2 grid gap-2 md:grid-cols-[120px_1fr_1fr_auto]">
                              <input
                                className="legacy-input"
                                type="number"
                                min={1}
                                max={response.transfer.dispatchedUnits ?? response.unitsOffered ?? undefined}
                                value={receiveDrafts[response.id]?.units ?? String(response.transfer.dispatchedUnits ?? response.unitsOffered ?? 1)}
                                onChange={(event) =>
                                  setReceiveDrafts((prev) => ({
                                    ...prev,
                                    [response.id]: {
                                      units: event.target.value,
                                      note: prev[response.id]?.note ?? '',
                                      condition: prev[response.id]?.condition ?? '',
                                    },
                                  }))
                                }
                              />
                              <input
                                className="legacy-input"
                                placeholder="Receive note"
                                value={receiveDrafts[response.id]?.note ?? ''}
                                onChange={(event) =>
                                  setReceiveDrafts((prev) => ({
                                    ...prev,
                                    [response.id]: {
                                      units: prev[response.id]?.units ?? String(response.transfer?.dispatchedUnits ?? response.unitsOffered ?? 1),
                                      note: event.target.value,
                                      condition: prev[response.id]?.condition ?? '',
                                    },
                                  }))
                                }
                              />
                              <input
                                className="legacy-input"
                                placeholder="Condition / status"
                                value={receiveDrafts[response.id]?.condition ?? ''}
                                onChange={(event) =>
                                  setReceiveDrafts((prev) => ({
                                    ...prev,
                                    [response.id]: {
                                      units: prev[response.id]?.units ?? String(response.transfer?.dispatchedUnits ?? response.unitsOffered ?? 1),
                                      note: prev[response.id]?.note ?? '',
                                      condition: event.target.value,
                                    },
                                  }))
                                }
                              />
                              <button className="btn-primary !px-3 !py-2 text-sm" type="button" onClick={() => void receiveTransfer(response)}>
                                Confirm Received
                              </button>
                            </div>
                          </div>
                        ) : null}
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-muted">No hospital responses yet.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Your Hospital Response</h3>
                {!isHospitalSource(selectedRequest.requestSource) ? (
                  <p className="mt-2 text-sm text-muted">This request is not accepting hospital-source fulfillment.</p>
                ) : selectedRequest.currentHospitalResponse ? (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                    <p className="font-bold">Current response: {selectedRequest.currentHospitalResponse.responseType}</p>
                    <p>Status: {selectedRequest.currentHospitalResponse.status}</p>
                    <p>Units: {selectedRequest.currentHospitalResponse.unitsOffered ?? 'N/A'}</p>
                    {selectedRequest.currentHospitalResponse.note ? <p>Note: {selectedRequest.currentHospitalResponse.note}</p> : null}
                    <TransferFulfillmentSummary request={selectedRequest} />
                    {selectedRequest.currentHospitalResponse.transfer ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-white p-3">
                        <p className="font-bold">
                          Transfer:{' '}
                          {selectedRequest.currentHospitalResponse.transfer.status === 'ACCEPTED'
                            ? 'Accepted - Awaiting Dispatch'
                            : selectedRequest.currentHospitalResponse.transfer.status === 'DISPATCHED'
                              ? 'Dispatched - Awaiting Receiving Confirmation'
                              : selectedRequest.currentHospitalResponse.transfer.status === 'RECEIVED'
                                ? `${getFulfillmentProgress(selectedRequest).receivedUnits} of ${getFulfillmentProgress(selectedRequest).requestedUnits} units fulfilled`
                                : selectedRequest.currentHospitalResponse.transfer.status}
                        </p>
                        <p>Accepted units: {selectedRequest.currentHospitalResponse.transfer.units}</p>
                        {selectedRequest.currentHospitalResponse.transfer.dispatchedUnits ? (
                          <p>Dispatched units: {selectedRequest.currentHospitalResponse.transfer.dispatchedUnits}</p>
                        ) : null}
                        {selectedRequest.currentHospitalResponse.transfer.receivedUnits ? (
                          <p>Received units: {selectedRequest.currentHospitalResponse.transfer.receivedUnits}</p>
                        ) : null}
                      </div>
                    ) : null}
                    {selectedRequest.currentHospitalResponse.transfer?.status === 'ACCEPTED' ? (
                      <div className="mt-3 rounded-xl border border-red-100 bg-white p-3">
                        <p className="font-bold text-slate-900">Dispatch Blood</p>
                        <p className="text-sm text-muted">Dispatching decreases your hospital inventory and notifies the requesting hospital.</p>
                        <div className="mt-2 grid gap-2 md:grid-cols-[120px_1fr_1fr_auto]">
                          <input
                            className="legacy-input"
                            type="number"
                            min={1}
                            max={selectedRequest.currentHospitalResponse.transfer.units}
                            value={dispatchDrafts[selectedRequest.currentHospitalResponse.id]?.units ?? String(selectedRequest.currentHospitalResponse.transfer.units)}
                            onChange={(event) =>
                              setDispatchDrafts((prev) => ({
                                ...prev,
                                [selectedRequest.currentHospitalResponse!.id]: {
                                  units: event.target.value,
                                  note: prev[selectedRequest.currentHospitalResponse!.id]?.note ?? '',
                                  reference: prev[selectedRequest.currentHospitalResponse!.id]?.reference ?? '',
                                },
                              }))
                            }
                          />
                          <input
                            className="legacy-input"
                            placeholder="Dispatch note"
                            value={dispatchDrafts[selectedRequest.currentHospitalResponse.id]?.note ?? ''}
                            onChange={(event) =>
                              setDispatchDrafts((prev) => ({
                                ...prev,
                                [selectedRequest.currentHospitalResponse!.id]: {
                                  units:
                                    prev[selectedRequest.currentHospitalResponse!.id]?.units ??
                                    String(selectedRequest.currentHospitalResponse!.transfer?.units ?? 1),
                                  note: event.target.value,
                                  reference: prev[selectedRequest.currentHospitalResponse!.id]?.reference ?? '',
                                },
                              }))
                            }
                          />
                          <input
                            className="legacy-input"
                            placeholder="Dispatch reference"
                            value={dispatchDrafts[selectedRequest.currentHospitalResponse.id]?.reference ?? ''}
                            onChange={(event) =>
                              setDispatchDrafts((prev) => ({
                                ...prev,
                                [selectedRequest.currentHospitalResponse!.id]: {
                                  units:
                                    prev[selectedRequest.currentHospitalResponse!.id]?.units ??
                                    String(selectedRequest.currentHospitalResponse!.transfer?.units ?? 1),
                                  note: prev[selectedRequest.currentHospitalResponse!.id]?.note ?? '',
                                  reference: event.target.value,
                                },
                              }))
                            }
                          />
                          <button
                            className="btn-primary !px-3 !py-2 text-sm"
                            type="button"
                            onClick={() => void dispatchTransfer(selectedRequest.currentHospitalResponse!)}
                          >
                            Dispatch Blood
                          </button>
                        </div>
                      </div>
                    ) : selectedRequest.currentHospitalResponse.transfer?.status === 'DISPATCHED' ? (
                      <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 font-semibold text-amber-800">
                        Dispatched - awaiting receiving confirmation.
                      </p>
                    ) : selectedRequest.currentHospitalResponse.transfer?.status === 'RECEIVED' ? (
                      <p className="mt-3 rounded-lg border border-emerald-100 bg-emerald-50 p-3 font-semibold text-emerald-800">
                        Transfer completed and inventory receipt confirmed.
                      </p>
                    ) : selectedRequest.currentHospitalResponse.responseType === 'CANNOT_FULFILL' ? (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                        <p className="font-bold text-slate-900">Your hospital marked this request as unable to fulfil.</p>
                        {selectedRequest.currentHospitalResponse.note ? <p className="mt-1">Reason: {selectedRequest.currentHospitalResponse.note}</p> : null}
                      </div>
                    ) : selectedRequest.currentHospitalResponse.status === 'ACCEPTED' ? (
                      <p className="mt-3 rounded-lg border border-amber-100 bg-amber-50 p-3 font-semibold text-amber-800">
                        Accepted - awaiting dispatch record.
                      </p>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-xl border border-slate-100 p-3">
                      <p className="font-bold text-slate-900">Your Hospital Stock</p>
                      <p className="mt-1 text-sm">
                        Requested blood group stock:{' '}
                        <span className="font-bold">{selectedRequest.currentHospitalStock?.availableUnits ?? 0} unit(s)</span>
                      </p>
                      <p className="text-sm">
                        Compatible stock:{' '}
                        <span className="font-bold">{selectedRequest.currentHospitalStock?.compatibleUnits ?? 0} unit(s)</span>
                      </p>
                      {selectedRequest.currentHospitalStock?.isLowStock ? (
                        <p className="mt-2 text-sm font-semibold text-amber-700">Low stock warning for this blood group.</p>
                      ) : null}
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3">
                      <p className="font-bold text-slate-900">Offer Units</p>
                      <div className="mt-2 grid gap-2">
                        <input className="legacy-input" type="number" min={1} value={offerUnits} onChange={(e) => setOfferUnits(e.target.value)} />
                        <textarea className="legacy-input min-h-20" placeholder="Optional note" value={offerNote} onChange={(e) => setOfferNote(e.target.value)} />
                        <button className="btn-primary" type="button" onClick={() => void submitOffer()}>
                          Submit Offer
                        </button>
                      </div>
                    </div>
                    <div className="rounded-xl border border-slate-100 p-3 lg:col-span-2">
                      <p className="font-bold text-slate-900">Cannot Fulfill</p>
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_auto]">
                        <input className="legacy-input" placeholder="Reason / note required" value={cannotFulfillNote} onChange={(e) => setCannotFulfillNote(e.target.value)} required />
                        <button className="rounded-xl border border-slate-200 px-4 py-2 font-bold text-slate-700" type="button" onClick={() => void submitCannotFulfill()}>
                          Cannot Fulfill
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-3 text-sm text-muted">Secure hospital messaging is not yet enabled. Use the recorded offer or unable-to-fulfil response for auditable coordination.</p>
              </div>
            )}

            {selectedRequest.donorResponses?.length ? (
              <div className="rounded-2xl border border-slate-200 p-4">
                <h3 className="font-bold text-slate-900">Donor Responses</h3>
                <div className="mt-3 space-y-2">
                  {selectedRequest.donorResponses.map((response) => (
                    <div key={response.id} className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-slate-50 p-3">
                      <div>
                        <p className="text-sm font-bold">{response.donor.fullName}</p>
                        <p className="text-xs text-muted">
                          {response.donor.donorNumber ?? 'Donor reference pending'} - {formatBloodGroup(response.donor.bloodGroup)} - {response.responseStatus}
                        </p>
                        <p className="text-xs text-muted">
                          Responded: {response.responseTime ? new Date(response.responseTime).toLocaleString() : 'Awaiting response'}
                        </p>
                        {response.notes ? <p className="mt-1 text-xs text-slate-600">Note: {response.notes}</p> : null}
                      </div>
                      <Link
                        className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                        to={`/hospital/appointments?donorId=${response.donor.id}&requestId=${selectedRequest.id}&requestReference=${encodeURIComponent(selectedRequest.requestReference)}`}
                      >
                        Schedule Appointment
                      </Link>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>

      {message ? <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p> : null}
    </section>
  );
}
