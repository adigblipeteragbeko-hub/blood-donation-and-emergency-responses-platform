const emergencyCards = [
  { id: 1, bloodGroup: 'O_NEG', hospital: 'City Hospital', priority: 'CRITICAL', status: 'MATCHING' },
  { id: 2, bloodGroup: 'A_POS', hospital: 'County Medical', priority: 'HIGH', status: 'OPEN' },
];

export default function EmergencyRequestsPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold text-primary">Emergency Requests</h1>
      {emergencyCards.map((card) => (
        <article key={card.id} className="card border-red-300">
          <p className="font-semibold text-red-700">{card.priority} Priority Alert</p>
          <p>Blood Group: {card.bloodGroup}</p>
          <p>Hospital: {card.hospital}</p>
          <p>Status: {card.status}</p>
          <button className="btn-primary mt-3">View and Respond</button>
        </article>
      ))}
    </section>
  );
}
