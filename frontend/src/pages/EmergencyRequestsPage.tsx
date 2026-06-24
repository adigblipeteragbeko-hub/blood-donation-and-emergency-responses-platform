import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  BloodRequestItem,
  DonorResponseStatus,
  getAllBloodRequests,
  getTypeaheadSuggestions,
  respondToBloodRequest,
  updateDonorAvailability,
} from '../services/hospital-portal';
import { FilterBox, Pager } from '../components/TableControls';
import { AsyncTypeahead, TypeaheadSuggestion } from '../components/ui/AsyncTypeahead';
import { AppIcon } from '../components/ui/AppIcon';

const bloodGroupLabel: Record<string, string> = {
  O_POS: 'O_POS (O+)',
  O_NEG: 'O_NEG (O-)',
  A_POS: 'A_POS (A+)',
  A_NEG: 'A_NEG (A-)',
  B_POS: 'B_POS (B+)',
  B_NEG: 'B_NEG (B-)',
  AB_POS: 'AB_POS (AB+)',
  AB_NEG: 'AB_NEG (AB-)',
};

export default function EmergencyRequestsPage() {
  const [searchParams] = useSearchParams();
  const focusRequestId = searchParams.get('requestId') ?? '';
  const [requests, setRequests] = useState<BloodRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 25;
  const [typeaheadQuery, setTypeaheadQuery] = useState('');

  const emergencyRequests = useMemo(
    () =>
      requests.filter(
        (item) =>
          (item.type === 'EMERGENCY' || item.priority === 'CRITICAL') &&
          (!searchTerm ||
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
            (item.ward ?? '').toLowerCase().includes(searchTerm)),
      ),
    [requests, searchTerm],
  );

  const loadRequests = async (nextPage = page) => {
    try {
      const data = await getAllBloodRequests({ skip: nextPage * pageSize, take: pageSize });
      setRequests(data);
      setHasMore(data.length === pageSize);
    } catch {
      setMessage('Unable to load emergency requests right now.');
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
    const timer = window.setTimeout(() => {
      document.getElementById(`request-${focusRequestId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [focusRequestId, emergencyRequests.length]);

  const respond = async (id: string, responseStatus: DonorResponseStatus) => {
    try {
      await respondToBloodRequest(id, { responseStatus, notes: notes[id] || undefined });
      setMessage(`Response recorded as ${responseStatus}.`);
      await loadRequests();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to submit response.');
    }
  };

  const markUnavailable = async (id: string) => {
    try {
      await updateDonorAvailability(false);
      await respondToBloodRequest(id, {
        responseStatus: 'DECLINED',
        notes: notes[id] ? `${notes[id]} | Marked unavailable by donor.` : 'Marked unavailable by donor.',
      });
      setMessage('Availability set to unavailable and response recorded as declined.');
      await loadRequests();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to mark unavailable.');
    }
  };

  return (
    <section className="mx-auto max-w-5xl space-y-4 px-4 pt-1 sm:px-6">
      <h1 className="flex items-center gap-2 text-2xl font-bold text-primary">
        <AppIcon name="alert" className="h-5 w-5 text-red-600" />
        Emergency Requests
      </h1>
      <p className="text-sm text-gray-600">Respond quickly: accept, decline, or mark unavailable.</p>
      <div className="grid gap-3 md:grid-cols-2">
        <FilterBox
          label="Filter emergency requests (debounced)"
          placeholder="Filter by hospital, blood group, status, urgency, or location..."
          value={searchInput}
          onChange={setSearchInput}
        />
        <AsyncTypeahead
          label="Search emergency records"
          value={typeaheadQuery}
          onChange={setTypeaheadQuery}
          placeholder="Type hospital, blood group, location..."
          loadSuggestions={async (query): Promise<TypeaheadSuggestion[]> => {
            const payload = await getTypeaheadSuggestions(query);
            return [
              ...payload.hospitals.map((item) => ({
                id: `hospital-${item.id}`,
                label: item.hospitalName,
                description: item.location,
                category: 'Hospital',
                value: item.hospitalName,
              })),
              ...payload.emergencyRequests.map((item) => ({
                id: `request-${item.id}`,
                label: `${item.bloodGroup} - ${item.unitsNeeded} units`,
                description: item.location,
                category: 'Emergency',
                value: item.bloodGroup,
              })),
              ...payload.locations.map((location, index) => ({
                id: `location-${index}`,
                label: location,
                category: 'Location',
                value: location,
              })),
            ];
          }}
          onSelect={(suggestion) => setSearchInput(suggestion.value ?? suggestion.label)}
        />
      </div>
      {loading ? (
        <div className="card">
          <p className="text-sm text-gray-600">Loading requests...</p>
        </div>
      ) : null}
      {!loading && emergencyRequests.length === 0 ? (
        <div className="card">
          <p className="text-sm text-gray-600">No emergency requests yet.</p>
        </div>
      ) : (
        emergencyRequests.map((card) => (
          <article
            id={`request-${card.id}`}
            key={card.id}
            className={`card border-red-300 ${focusRequestId === card.id ? 'ring-2 ring-red-400' : ''}`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-semibold text-red-700">{card.priority} Priority Alert</p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${card.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'}`}
              >
                {card.priority}
              </span>
            </div>
            <div className="mt-3 grid gap-2 md:grid-cols-2">
              <p>
                <span className="font-semibold">Request Reference:</span> {card.requestReference}
              </p>
              <p>
                <span className="font-semibold">Blood Group:</span> {bloodGroupLabel[card.bloodGroup] ?? card.bloodGroup}
              </p>
              <p>
                <span className="font-semibold">Units Required:</span> {card.unitsNeeded}
              </p>
              <p>
                <span className="font-semibold">Hospital:</span> {card.hospital?.hospitalName ?? 'Hospital'}
              </p>
              <p>
                <span className="font-semibold">Center:</span> {card.hospitalCenterName ?? card.hospital?.hospitalName ?? 'N/A'}
              </p>
              <p>
                <span className="font-semibold">Status:</span> {card.status} / {card.trackingStatus}
              </p>
              <p>
                <span className="font-semibold">Request Source:</span> {card.requestSource}
              </p>
              <p>
                <span className="font-semibold">Ward:</span> {card.ward ?? 'N/A'}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">Created:</span> {new Date(card.createdAt).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600">
                <span className="font-semibold text-gray-800">Need By:</span> {new Date(card.requiredBy).toLocaleString()}
              </p>
              <p className="text-sm text-gray-600 md:col-span-2">
                <span className="font-semibold text-gray-800">Location:</span> {card.emergencyLocation ?? card.location}
              </p>
              <p className="text-sm text-gray-600 md:col-span-2">
                <span className="font-semibold text-gray-800">City/Region:</span> {[card.city, card.region].filter(Boolean).join(', ') || 'N/A'}
              </p>
              <p className="text-sm text-gray-600 md:col-span-2">
                <span className="font-semibold text-gray-800">Location Notes:</span> {card.locationNotes ?? 'N/A'}
              </p>
              <p className="text-sm text-gray-600 md:col-span-2">
                <span className="font-semibold text-gray-800">Comments / Reason:</span> {card.patientName ?? card.hospitalPatientReference ?? 'Not provided'}
              </p>
              <p className="text-sm text-gray-600 md:col-span-2">
                <span className="font-semibold text-gray-800">Emergency Notes:</span> {card.notes ?? 'No emergency notes provided.'}
              </p>
            </div>
            <p className="mt-2 text-sm text-gray-600">Your response: {card.donorResponses?.[0]?.responseStatus ?? 'PENDING'}</p>
            {card.donorResponses?.length ? (
              <div className="mt-2 rounded-lg border border-gray-200 bg-gray-50 p-3 text-xs text-gray-700">
                <p className="font-semibold text-gray-800">Donor responses</p>
                <div className="mt-2 space-y-1">
                  {card.donorResponses.slice(0, 3).map((response) => (
                    <p key={response.id}>
                      {response.donor?.fullName ?? 'Donor'}: {response.responseStatus}
                    </p>
                  ))}
                </div>
              </div>
            ) : null}
            <textarea
              className="legacy-input mt-3 min-h-20"
              placeholder="Optional note for hospital"
              value={notes[card.id] ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [card.id]: e.target.value }))}
            />
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={() => void respond(card.id, 'ACCEPTED')} type="button">
                Accept
              </button>
              <button
                className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700"
                onClick={() => void respond(card.id, 'DECLINED')}
                type="button"
              >
                Decline
              </button>
              <button
                className="rounded-lg border border-emerald-300 px-4 py-2 font-semibold text-emerald-700"
                onClick={() => void respond(card.id, 'DONATED')}
                type="button"
              >
                Mark Donated
              </button>
              <button
                className="rounded-lg border border-slate-300 px-4 py-2 font-semibold text-slate-700"
                onClick={() => void markUnavailable(card.id)}
                type="button"
              >
                Mark Unavailable
              </button>
            </div>
          </article>
        ))
      )}
      <Pager
        page={page}
        hasMore={hasMore}
        onPrev={() => setPage((value) => Math.max(0, value - 1))}
        onNext={() => setPage((value) => value + 1)}
      />
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </section>
  );
}
