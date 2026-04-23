import { useEffect, useMemo, useState } from 'react';
import {
  BloodRequestItem,
  DonorResponseStatus,
  getAllBloodRequests,
  respondToBloodRequest,
} from '../services/hospital-portal';

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
  const [requests, setRequests] = useState<BloodRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});

  const emergencyRequests = useMemo(
    () => requests.filter((item) => item.type === 'EMERGENCY' || item.priority === 'CRITICAL'),
    [requests],
  );

  const loadRequests = async () => {
    try {
      const data = await getAllBloodRequests();
      setRequests(data);
    } catch {
      setMessage('Unable to load emergency requests right now.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadRequests();
  }, []);

  const respond = async (id: string, responseStatus: DonorResponseStatus) => {
    try {
      await respondToBloodRequest(id, { responseStatus, notes: notes[id] || undefined });
      setMessage(`Response recorded as ${responseStatus}.`);
      await loadRequests();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Unable to submit response.');
    }
  };

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold text-primary">Emergency Requests</h1>
      <p className="text-sm text-gray-600">View urgent blood requests and respond (accept/decline).</p>
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
          <article key={card.id} className="card border-red-300">
            <p className="font-semibold text-red-700">{card.priority} Priority Alert</p>
            <p>Blood Group: {bloodGroupLabel[card.bloodGroup] ?? card.bloodGroup}</p>
            <p>Hospital: {card.hospital?.hospitalName ?? 'Hospital'}</p>
            <p>Status: {card.trackingStatus}</p>
            <p className="text-sm text-gray-600">Need By: {new Date(card.requiredBy).toLocaleString()}</p>
            <p className="text-sm text-gray-600">
              Your response: {card.donorResponses?.[0]?.responseStatus ?? 'PENDING'}
            </p>
            <textarea
              className="legacy-input mt-3 min-h-20"
              placeholder="Optional note for hospital"
              value={notes[card.id] ?? ''}
              onChange={(e) => setNotes((prev) => ({ ...prev, [card.id]: e.target.value }))}
            />
            <div className="mt-3 flex gap-2">
              <button
                className="btn-primary"
                onClick={() => void respond(card.id, 'ACCEPTED')}
                type="button"
              >
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
            </div>
          </article>
        ))
      )}
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </section>
  );
}
