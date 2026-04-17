export default function HistoryPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">History</h1>
      <p className="text-sm text-gray-600">View past donations, completed appointments, and emergency responses.</p>
      <ul className="space-y-2 text-sm">
        <li className="rounded border border-gray-200 p-3">Donation at City Hospital - Jan 20</li>
        <li className="rounded border border-gray-200 p-3">Emergency request accepted - Mar 04</li>
      </ul>
    </section>
  );
}
