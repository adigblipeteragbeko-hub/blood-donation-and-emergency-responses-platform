import { useState } from 'react';

type DonationItem = {
  id: number;
  date: string;
  location: string;
  status: string;
};

export default function HistoryPage() {
  const [donations] = useState<DonationItem[]>([]);

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Donation History</h1>
      <p className="text-sm text-gray-600">List of past donations with dates, locations, and status.</p>
      {donations.length === 0 ? (
        <p className="rounded border border-gray-200 p-3 text-sm text-gray-600">No donations recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-red-200 text-primary">
                <th className="py-2">Date</th>
                <th className="py-2">Location</th>
                <th className="py-2">Status</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((item) => (
                <tr key={item.id} className="border-b border-gray-100">
                  <td className="py-2">{item.date}</td>
                  <td className="py-2">{item.location}</td>
                  <td className="py-2">{item.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
