const centers = [
  { id: 1, name: 'City Hospital Blood Center', distance: '2.1 km', address: 'Ring Road, Accra' },
  { id: 2, name: 'Regional Blood Bank', distance: '3.8 km', address: 'Central Avenue, Accra' },
  { id: 3, name: 'County Medical Donation Unit', distance: '5.4 km', address: 'Airport Residential Area' },
];

export default function NearbyCentersPage() {
  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Nearby Centers</h1>
      <p className="text-sm text-gray-600">View hospitals or blood banks near your location.</p>
      <div className="space-y-2">
        {centers.map((center) => (
          <article key={center.id} className="rounded border border-gray-200 p-3">
            <p className="font-semibold text-primary">{center.name}</p>
            <p className="text-sm text-gray-600">Distance: {center.distance}</p>
            <p className="text-sm text-gray-600">Address: {center.address}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
