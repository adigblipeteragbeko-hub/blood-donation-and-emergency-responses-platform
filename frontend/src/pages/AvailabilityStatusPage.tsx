import { useState } from 'react';

export default function AvailabilityStatusPage() {
  const [available, setAvailable] = useState<boolean | null>(null);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Availability Status</h1>
      <p className="text-sm text-gray-600">Toggle your donation availability so hospitals can contact you correctly.</p>
      <div className="rounded border border-gray-200 p-4">
        <p className="text-sm text-gray-600">Current status</p>
        <p className="text-xl font-bold text-primary">
          {available === null ? 'Not set' : available ? 'Available for Donation' : 'Not Available'}
        </p>
      </div>
      <div className="flex gap-2">
        <button className="btn-primary" onClick={() => setAvailable(true)} type="button">
          Set Available
        </button>
        <button className="rounded-lg border border-red-300 px-4 py-2 font-semibold text-red-700" onClick={() => setAvailable(false)} type="button">
          Set Not Available
        </button>
      </div>
    </section>
  );
}
