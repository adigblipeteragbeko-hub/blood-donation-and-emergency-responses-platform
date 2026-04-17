import { useState } from 'react';

type EmergencyItem = {
  id: number;
  bloodGroup: string;
  hospital: string;
  priority: string;
  status: string;
  response: string;
};

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
  const [requests, setRequests] = useState<EmergencyItem[]>([]);

  const respond = (id: number, response: 'Accepted' | 'Declined') => {
    setRequests((prev) => prev.map((item) => (item.id === id ? { ...item, response } : item)));
  };

  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold text-primary">Emergency Requests</h1>
      <p className="text-sm text-gray-600">View urgent blood requests and respond (accept/decline).</p>
      {requests.length === 0 ? (
        <div className="card">
          <p className="text-sm text-gray-600">No emergency requests yet.</p>
        </div>
      ) : (
        requests.map((card) => (
          <article key={card.id} className="card border-red-300">
            <p className="font-semibold text-red-700">{card.priority} Priority Alert</p>
            <p>Blood Group: {bloodGroupLabel[card.bloodGroup] ?? card.bloodGroup}</p>
            <p>Hospital: {card.hospital}</p>
            <p>Status: {card.status}</p>
            <p className="text-sm text-gray-600">Your response: {card.response || 'Pending'}</p>
            <div className="mt-3 flex gap-2">
              <button className="btn-primary" onClick={() => respond(card.id, 'Accepted')} type="button">
                Accept
              </button>
              <button className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700" onClick={() => respond(card.id, 'Declined')} type="button">
                Decline
              </button>
            </div>
          </article>
        ))
      )}
    </section>
  );
}
