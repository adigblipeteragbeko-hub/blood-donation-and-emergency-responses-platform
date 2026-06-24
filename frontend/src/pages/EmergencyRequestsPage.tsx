import { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BloodRequestItem,
  DonorResponseStatus,
  getDonorEmergencyRequestById,
  getDonorEmergencyRequests,
  respondToBloodRequest,
  updateDonorAvailability,
} from '../services/hospital-portal';
import { FilterBox, Pager } from '../components/TableControls';
import { AppIcon } from '../components/ui/AppIcon';

const bloodGroupLabel: Record<string, string> = {
  O_POS: 'O+',
  O_NEG: 'O-',
  A_POS: 'A+',
  A_NEG: 'A-',
  B_POS: 'B+',
  B_NEG: 'B-',
  AB_POS: 'AB+',
  AB_NEG: 'AB-',
};

const closedStatuses = ['FULFILLED', 'COMPLETED', 'CANCELLED', 'CANCELED'];

function formatDate(value?: string | null) {
  return value
    ? new Date(value).toLocaleString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
      })
    : 'Date not recorded';
}

function priorityBadge(priority?: string) {
  const value = String(priority ?? '').toUpperCase();
  if (value === 'HIGH' || value === 'CRITICAL') return 'bg-red-50 text-red-700 border-red-100';
  if (value === 'MEDIUM') return 'bg-orange-50 text-orange-700 border-orange-100';
  return 'bg-blue-50 text-blue-700 border-blue-100';
}

function statusBadge(status?: string) {
  const value = String(status ?? '').toUpperCase();
  if (value === 'FULFILLED' || value === 'COMPLETED') return 'bg-emerald-50 text-emerald-700 border-emerald-100';
  if (value === 'MATCHING' || value === 'MATCHED') return 'bg-amber-50 text-amber-700 border-amber-100';
  if (value === 'CANCELLED' || value === 'DECLINED' || value === 'EXPIRED') return 'bg-slate-100 text-slate-700 border-slate-200';
  return 'bg-blue-50 text-blue-700 border-blue-100';
}

function responseLabel(status?: DonorResponseStatus) {
  if (status === 'ACCEPTED') return 'I am available';
  if (status === 'DECLINED') return 'I am unavailable';
  if (status === 'DONATED') return 'Donation completed';
  return 'Awaiting your response';
}

function hasSubmittedResponse(request?: BloodRequestItem | null) {
  return request?.donorResponses?.some((response) => response.responseStatus !== 'PENDING') ?? false;
}

function canRespond(request: BloodRequestItem) {
  const context = request.donorMatchContext;
  const active = !closedStatuses.includes(String(request.status).toUpperCase());
  return Boolean(active && !hasSubmittedResponse(request) && context?.eligible && context.available && !context.inCooldown);
}

function unavailableReason(request: BloodRequestItem) {
  if (hasSubmittedResponse(request)) return null;
  if (closedStatuses.includes(String(request.status).toUpperCase())) return 'This request is no longer active.';
  if (!request.donorMatchContext?.eligible) return 'You cannot respond because you are no longer eligible.';
  if (!request.donorMatchContext?.available) return 'You cannot respond because your donor profile is not currently marked available.';
  if (request.donorMatchContext?.inCooldown) return 'You cannot respond because your donation cooldown is still active.';
  if (!request.donorMatchContext?.compatible) return 'You are no longer matched to this request.';
  return 'This request is no longer available for a new response from your account.';
}

export default function EmergencyRequestsPage() {
  const [searchParams] = useSearchParams();
  const focusRequestId = searchParams.get('requestId') ?? '';
  const detailsRef = useRef<HTMLDivElement | null>(null);
  const [requests, setRequests] = useState<BloodRequestItem[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<BloodRequestItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 25;

  const filteredRequests = useMemo(
    () =>
      requests.filter(
        (item) =>
          !searchTerm ||
          item.requestReference.toLowerCase().includes(searchTerm) ||
          item.bloodGroup.toLowerCase().includes(searchTerm) ||
          (item.hospital?.hospitalName ?? '').toLowerCase().includes(searchTerm) ||
          item.trackingStatus.toLowerCase().includes(searchTerm) ||
          item.status.toLowerCase().includes(searchTerm) ||
          item.priority.toLowerCase().includes(searchTerm) ||
          item.requestSource.toLowerCase().includes(searchTerm) ||
          item.location.toLowerCase().includes(searchTerm) ||
          (item.emergencyLocation ?? '').toLowerCase().includes(searchTerm) ||
          (item.city ?? '').toLowerCase().includes(searchTerm) ||
          (item.region ?? '').toLowerCase().includes(searchTerm) ||
          (item.ward ?? '').toLowerCase().includes(searchTerm),
      ),
    [requests, searchTerm],
  );

  const loadRequests = async (nextPage = page) => {
    try {
      setLoading(true);
      setMessage('');
      const data = await getDonorEmergencyRequests({ skip: nextPage * pageSize, take: pageSize });
      setRequests(data);
      setHasMore(data.length === pageSize);
      if (!focusRequestId && !selectedRequest && data.length > 0) {
        setSelectedRequest(data[0]);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to load emergency requests right now.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    if (!focusRequestId) return;

    const loadFocusedRequest = async () => {
      try {
        const request = await getDonorEmergencyRequestById(focusRequestId);
        setSelectedRequest(request);
        setRequests((current) => (current.some((item) => item.id === request.id) ? current : [request, ...current]));
        window.setTimeout(() => detailsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
      } catch {
        setMessage('This emergency request is no longer available to your account.');
      }
    };

    void loadFocusedRequest();
  }, [focusRequestId]);

  const respond = async (request: BloodRequestItem, responseStatus: DonorResponseStatus) => {
    if (hasSubmittedResponse(request)) {
      setMessage('Your response has already been submitted.');
      return;
    }
    if (!canRespond(request)) {
      setMessage(unavailableReason(request) ?? 'This request is no longer available for a new response from your account.');
      return;
    }

    try {
      await respondToBloodRequest(request.id, { responseStatus, notes: notes[request.id] || undefined });
      setMessage('Your response has been submitted. Hospital staff can now see your response.');
      await loadRequests();
      const refreshed = await getDonorEmergencyRequestById(request.id);
      setSelectedRequest(refreshed);
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to submit your response. Please try again.');
    }
  };

  const markUnavailable = async (request: BloodRequestItem) => {
    try {
      await respond(request, 'DECLINED');
      await updateDonorAvailability(false);
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to update your availability.');
    }
  };

  const selectedResponse = selectedRequest?.donorResponses?.[0] ?? null;
  const selectedAlreadyResponded = hasSubmittedResponse(selectedRequest);
  const selectedCanRespond = selectedRequest ? canRespond(selectedRequest) : false;
  const selectedContext = selectedRequest?.donorMatchContext;
  const selectedUnavailableReason = selectedRequest ? unavailableReason(selectedRequest) : null;

  return (
    <section className="mx-auto max-w-7xl space-y-6 px-4 pt-1 sm:px-6">
      <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm">
        <p className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.22em] text-red-600">
          <AppIcon name="alert" className="h-4 w-4" />
          Emergency donor response
        </p>
        <h1 className="mt-2 text-3xl font-black text-slate-950">Matched Emergency Requests</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-600">
          These requests are matched to your donor profile. Respond only if you can safely attend.
        </p>
      </div>

      <FilterBox
        label="Filter matched requests"
        placeholder="Filter by hospital, reference, blood group, status, urgency, or location..."
        value={searchInput}
        onChange={setSearchInput}
      />

      {message ? <p className="rounded-xl border border-red-100 bg-red-50 p-3 text-sm font-semibold text-red-700">{message}</p> : null}

      {loading ? (
        <div className="card">
          <p className="text-sm text-gray-600">Loading matched emergency requests...</p>
        </div>
      ) : null}

      {!loading && filteredRequests.length === 0 ? (
        <div className="card">
          <p className="text-sm font-semibold text-slate-800">No active emergency requests matched to you right now.</p>
          {focusRequestId ? (
            <p className="mt-1 text-sm text-slate-600">If you opened this from an alert, the request may have been fulfilled, cancelled, or assigned to another donor group.</p>
          ) : null}
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(420px,0.9fr)_minmax(540px,1.1fr)]">
          <div className="space-y-4">
            {filteredRequests.map((card) => {
              const response = card.donorResponses?.[0] ?? null;
              const distance = card.donorMatchContext?.distanceKm;
              return (
                <button
                  id={`request-${card.id}`}
                  key={card.id}
                  className={`w-full cursor-pointer rounded-3xl border bg-white p-5 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${
                    selectedRequest?.id === card.id ? 'border-red-400 ring-2 ring-red-100' : 'border-slate-200'
                  }`}
                  onClick={() => setSelectedRequest(card)}
                  type="button"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">{card.requestReference}</p>
                      <h2 className="mt-1 text-lg font-black text-slate-950">{card.hospital?.hospitalName ?? 'Hospital'}</h2>
                      <p className="mt-1 text-sm text-slate-600">
                        {bloodGroupLabel[card.bloodGroup] ?? card.bloodGroup} blood | {card.unitsNeeded} unit(s) | {card.ward ?? 'Ward not specified'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${priorityBadge(card.priority)}`}>{card.priority}</span>
                      <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusBadge(card.status)}`}>{card.status}</span>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-3 rounded-2xl bg-slate-50 p-3 text-sm text-slate-600 sm:grid-cols-2">
                    <p><span className="font-semibold text-slate-900">Required by:</span> {formatDate(card.requiredBy)}</p>
                    <p><span className="font-semibold text-slate-900">Distance:</span> {typeof distance === 'number' ? `${distance.toFixed(1)} km away` : 'Not available'}</p>
                    <p><span className="font-semibold text-slate-900">Status:</span> {card.trackingStatus}</p>
                    <p><span className="font-semibold text-slate-900">Your response:</span> {responseLabel(response?.responseStatus)}</p>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedRequest ? (
            <div ref={detailsRef} className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm xl:sticky xl:top-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-600">{selectedRequest.requestReference}</p>
                  <h2 className="mt-1 text-2xl font-black text-slate-950">Emergency Response Details</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${priorityBadge(selectedRequest.priority)}`}>{selectedRequest.priority}</span>
                  <span className={`rounded-full border px-3 py-1 text-xs font-black uppercase ${statusBadge(selectedRequest.status)}`}>{selectedRequest.status}</span>
                </div>
              </div>

              <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Request Summary</p>
                <div className="mt-3 grid gap-4 text-sm text-slate-700 sm:grid-cols-2">
                  <p><span className="block text-xs font-bold uppercase text-slate-500">Hospital</span>{selectedRequest.hospital?.hospitalName ?? 'Hospital'}</p>
                  <p><span className="block text-xs font-bold uppercase text-slate-500">Blood Group</span>{bloodGroupLabel[selectedRequest.bloodGroup] ?? selectedRequest.bloodGroup}</p>
                  <p><span className="block text-xs font-bold uppercase text-slate-500">Units Requested</span>{selectedRequest.unitsNeeded}</p>
                  <p><span className="block text-xs font-bold uppercase text-slate-500">Status</span>{selectedRequest.status} / {selectedRequest.trackingStatus}</p>
                  <p><span className="block text-xs font-bold uppercase text-slate-500">Required By</span>{formatDate(selectedRequest.requiredBy)}</p>
                  <p><span className="block text-xs font-bold uppercase text-slate-500">Ward / Unit</span>{selectedRequest.ward ?? 'Not specified'}</p>
                  <p className="sm:col-span-2"><span className="block text-xs font-bold uppercase text-slate-500">Location</span>{selectedRequest.emergencyLocation ?? selectedRequest.location}</p>
                  <p className="sm:col-span-2"><span className="block text-xs font-bold uppercase text-slate-500">Emergency Notes</span>{selectedRequest.notes ?? selectedRequest.locationNotes ?? 'No additional notes provided.'}</p>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-sm text-emerald-800">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-emerald-700">Compatibility</p>
                <p className="mt-2">
                  Your blood group {selectedContext?.bloodGroup ? bloodGroupLabel[selectedContext.bloodGroup] ?? selectedContext.bloodGroup : 'on file'} is
                  {selectedContext?.compatible ? ' compatible with this request.' : ' not currently compatible with this request.'}
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <p><span className="font-bold">Eligible:</span> {selectedContext?.eligible ? 'Yes' : 'No'}</p>
                  <p><span className="font-bold">Available:</span> {selectedContext?.available ? 'Yes' : 'No'}</p>
                  <p><span className="font-bold">Cooldown:</span> {selectedContext?.inCooldown ? 'Active' : 'No active cooldown'}</p>
                  <p><span className="font-bold">Location sharing:</span> {selectedContext?.locationSharingEnabled ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>

              {selectedAlreadyResponded && selectedResponse ? (
                <div className="mt-4 rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-800">
                  <p className="text-xs font-black uppercase tracking-[0.18em] text-blue-700">Your Response</p>
                  <p className="mt-2 font-semibold">Your response has been submitted: {responseLabel(selectedResponse.responseStatus)}.</p>
                  <p className="mt-1">Hospital staff can now see your response.</p>
                  {selectedResponse.notes ? <p className="mt-2 text-blue-700">Note: {selectedResponse.notes}</p> : null}
                </div>
              ) : null}

              {!selectedCanRespond && selectedUnavailableReason ? (
                <p className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
                  {selectedUnavailableReason}
                </p>
              ) : null}

              <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-4">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">Notes</p>
                <textarea
                  className="legacy-input mt-3 min-h-24"
                  disabled={!selectedCanRespond}
                  placeholder={selectedCanRespond ? 'Optional note for the hospital' : 'Response notes are locked after submission'}
                  value={notes[selectedRequest.id] ?? ''}
                  onChange={(event) => setNotes((prev) => ({ ...prev, [selectedRequest.id]: event.target.value }))}
                />
              </div>

              {selectedCanRespond ? (
                <div className="mt-5 flex flex-wrap gap-3">
                  <button className="btn-primary min-w-40" onClick={() => void respond(selectedRequest, 'ACCEPTED')} type="button">
                    I am available
                  </button>
                  <button
                    className="min-w-40 rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700"
                    onClick={() => void respond(selectedRequest, 'DECLINED')}
                    type="button"
                  >
                    I am unavailable
                  </button>
                  <button
                    className="min-w-40 rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                    onClick={() => void markUnavailable(selectedRequest)}
                    type="button"
                  >
                    Mark unavailable
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50 p-4 text-sm font-semibold text-slate-700">
                  {selectedAlreadyResponded ? 'Response submitted' : 'Response actions unavailable'}
                </div>
              )}
            </div>
          ) : null}
        </div>
      )}

      <Pager
        page={page}
        hasMore={hasMore}
        onPrev={() => setPage((value) => Math.max(0, value - 1))}
        onNext={() => setPage((value) => value + 1)}
      />
    </section>
  );
}
