const badges = [
  'First Donation',
  'Emergency Responder',
  'Three Donations Milestone',
];

export default function RewardsPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Rewards / Achievements</h1>
      <p className="text-sm text-gray-600">Track badges, donation count, and recognition for your impact.</p>
      <div className="rounded border border-gray-200 p-4">
        <p className="text-sm text-gray-600">Total Donations</p>
        <p className="text-2xl font-bold text-primary">4</p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {badges.map((badge) => (
          <div key={badge} className="rounded border border-red-200 bg-red-50 p-3 text-sm font-semibold text-primary">
            {badge}
          </div>
        ))}
      </div>
    </section>
  );
}
