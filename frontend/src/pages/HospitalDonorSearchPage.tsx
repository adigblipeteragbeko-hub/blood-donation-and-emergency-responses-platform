import { FormEvent, useState } from 'react';
import { bloodGroups } from '../constants/blood-groups';
import { BloodGroup, DonorMatch, searchHospitalDonors } from '../services/hospital-portal';

export default function HospitalDonorSearchPage() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POS');
  const [location, setLocation] = useState('');
  const [radiusKm, setRadiusKm] = useState(25);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [results, setResults] = useState<DonorMatch[]>([]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setLoading(true);
    setMessage('');
    try {
      const donors = await searchHospitalDonors({ bloodGroup, location });
      setResults(donors);
      if (radiusKm) {
        setMessage(`Showing matching donors (radius preference ${radiusKm}km).`);
      }
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Search failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Donor Search</h1>
        <p className="text-sm text-muted">Find matching donors by blood type and location.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-3" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Blood Group
          <select className="legacy-input mt-1" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}>
            {bloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          City / Location
          <input className="legacy-input mt-1" type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          Radius (km)
          <input
            className="legacy-input mt-1"
            min={1}
            type="number"
            value={radiusKm}
            onChange={(e) => setRadiusKm(Number(e.target.value))}
          />
        </label>
        <button className="btn-primary md:col-span-3 md:w-fit" disabled={loading} type="submit">
          {loading ? 'Searching...' : 'Search Donors'}
        </button>
      </form>

      {message ? <p className="text-sm text-primary">{message}</p> : null}

      <div className="card overflow-x-auto">
        <h2 className="text-lg font-bold text-primary">Matching Donors</h2>
        {results.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No donors matched this search yet.</p>
        ) : (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Name</th>
                <th className="py-2 pr-3">Blood Group</th>
                <th className="py-2 pr-3">Location</th>
                <th className="py-2 pr-3">Contact</th>
              </tr>
            </thead>
            <tbody>
              {results.map((donor) => (
                <tr key={donor.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{donor.fullName}</td>
                  <td className="py-2 pr-3">{bloodGroups.find((group) => group.value === donor.bloodGroup)?.label ?? donor.bloodGroup}</td>
                  <td className="py-2 pr-3">{donor.location}</td>
                  <td className="py-2 pr-3">{donor.emergencyContactPhone}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

