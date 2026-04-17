export default function EligibilityPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Eligibility Status</h1>
      <p className="text-sm text-gray-600">Shows if donor can donate now or next available date.</p>
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
        Status is not available yet. Complete your profile and health form to calculate eligibility.
      </div>
      <div className="rounded-md border border-gray-200 p-3 text-sm text-gray-700">
        Next available date: <span className="font-semibold">Not available</span>
      </div>
    </section>
  );
}
