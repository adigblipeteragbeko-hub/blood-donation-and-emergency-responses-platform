import { FormEvent, useState } from 'react';

type Center = { id: number; name: string; distance: string; address: string };

export default function NearbyCentersPage() {
  const [query, setQuery] = useState('');
  const [searched, setSearched] = useState(false);
  const [centers, setCenters] = useState<Center[]>([]);

  const searchCenters = (event: FormEvent) => {
    event.preventDefault();
    setSearched(true);
    setCenters([]);
  };

  return (
    <section className="card space-y-3">
      <h1 className="text-2xl font-bold text-primary">Nearby Centers</h1>
      <p className="text-sm text-gray-600">View hospitals or blood banks near your location.</p>
      <form className="flex gap-2" onSubmit={searchCenters}>
        <input className="legacy-input" placeholder="Enter your area" value={query} onChange={(e) => setQuery(e.target.value)} required />
        <button className="btn-primary" type="submit">Search</button>
      </form>

      {!searched ? <p className="text-sm text-gray-600">Search to load nearby centers.</p> : null}
      {searched && centers.length === 0 ? <p className="text-sm text-gray-600">No centers found yet.</p> : null}
    </section>
  );
}
