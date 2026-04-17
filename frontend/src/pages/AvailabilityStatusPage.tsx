import { useState } from 'react';

export default function AvailabilityStatusPage() {
  const [available, setAvailable] = useState(true);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Availability Status</h1>
      <p className="text-sm text-gray-600">Toggle your donation availability so hospitals can contact you correctly.</p>
      <div className="rounded border border-gray-200 p-4">
        <p className="text-sm text-gray-600">Current status</p>
        <p className="text-xl font-bold text-primary">{available ? 'Available for Donation' : 'Not Available'}</p>
      </div>
      <button className="btn-primary" onClick={() => setAvailable((v) => !v)} type="button">
        Set as {available ? 'Not Available' : 'Available'}
      </button>
    </section>
  );
}
