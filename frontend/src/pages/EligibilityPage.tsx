export default function EligibilityPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Eligibility</h1>
      <p className="text-sm text-gray-600">Review your current blood donation eligibility and update health-related details.</p>
      <div className="rounded-md border border-red-100 bg-red-50 p-3 text-sm">
        Current status: <span className="font-semibold text-primary">Eligible</span>
      </div>
    </section>
  );
}
