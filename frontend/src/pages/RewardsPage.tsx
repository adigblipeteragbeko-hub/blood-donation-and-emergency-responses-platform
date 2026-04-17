import { useState } from 'react';

export default function RewardsPage() {
  const [donationCount] = useState(0);
  const [badges] = useState<string[]>([]);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Rewards / Achievements</h1>
      <p className="text-sm text-gray-600">Track badges, donation count, and recognition for your impact.</p>
      <div className="rounded border border-gray-200 p-4">
        <p className="text-sm text-gray-600">Total Donations</p>
        <p className="text-2xl font-bold text-primary">{donationCount}</p>
      </div>
      {badges.length === 0 ? (
        <p className="rounded border border-gray-200 p-3 text-sm text-gray-600">No badges yet. Donate to unlock achievements.</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {badges.map((badge) => (
            <div key={badge} className="rounded border border-red-200 bg-red-50 p-3 text-sm font-semibold text-primary">
              {badge}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
