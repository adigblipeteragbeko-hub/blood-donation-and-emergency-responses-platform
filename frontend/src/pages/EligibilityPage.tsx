const today = new Date('2026-04-17');
const nextDate = new Date('2026-04-25');
const canDonateNow = today >= nextDate;

export default function EligibilityPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Eligibility Status</h1>
      <p className="text-sm text-gray-600">Shows if donor can donate now or next available date.</p>
      <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm">
        Current status:{' '}
        <span className="font-semibold text-primary">{canDonateNow ? 'Eligible to donate now' : 'Temporarily not eligible'}</span>
      </div>
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
        Next available date: <span className="font-semibold">April 25, 2026</span>
      </div>
      <ul className="list-disc space-y-1 pl-5 text-sm text-gray-700">
        <li>Minimum interval since last whole blood donation is 56 days.</li>
        <li>Health form must be up to date before your next appointment.</li>
        <li>Contact support if your status looks incorrect.</li>
      </ul>
    </section>
  );
}
