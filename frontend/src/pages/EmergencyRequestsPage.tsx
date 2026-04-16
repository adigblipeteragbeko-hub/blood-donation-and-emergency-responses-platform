const emergencyCards = [
  { id: 1, bloodGroup: 'O_NEG', hospital: 'City Hospital', priority: 'CRITICAL', status: 'MATCHING' },
  { id: 2, bloodGroup: 'A_POS', hospital: 'County Medical', priority: 'HIGH', status: 'OPEN' },
];
const bloodGroupLabel: Record<string, string> = {
  O_POS: 'O_POS (O+)',
  O_NEG: 'O_NEG (O-)',
  A_POS: 'A_POS (A+)',
  A_NEG: 'A_NEG (A-)',
  B_POS: 'B_POS (B+)',
  B_NEG: 'B_NEG (B-)',
  AB_POS: 'AB_POS (AB+)',
  AB_NEG: 'AB_NEG (AB-)',
};

export default function EmergencyRequestsPage() {
  return (
    <section className="space-y-3">
      <h1 className="text-2xl font-bold text-primary">Emergency Requests</h1>
      {emergencyCards.map((card) => (
        <article key={card.id} className="card border-red-300">
          <p className="font-semibold text-red-700">{card.priority} Priority Alert</p>
          <p>Blood Group: {bloodGroupLabel[card.bloodGroup] ?? card.bloodGroup}</p>
          <p>Hospital: {card.hospital}</p>
          <p>Status: {card.status}</p>
          <button className="btn-primary mt-3">View and Respond</button>
        </article>
      ))}
    </section>
  );
}
