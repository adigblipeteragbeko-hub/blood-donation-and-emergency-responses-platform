import { FormEvent, useState } from 'react';
import { bloodGroups } from '../constants/blood-groups';
import { BloodGroup, createHospitalRequest } from '../services/hospital-portal';

function defaultRequiredBy() {
  const date = new Date();
  date.setHours(date.getHours() + 2);
  return date.toISOString().slice(0, 16);
}

export default function HospitalEmergencyRequestsPage() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POS');
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [location, setLocation] = useState('');
  const [requiredBy, setRequiredBy] = useState(defaultRequiredBy());
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState('');

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setMessage('');
    try {
      await createHospitalRequest({
        bloodGroup,
        unitsNeeded,
        type: 'EMERGENCY',
        priority: 'CRITICAL',
        location,
        requiredBy: new Date(requiredBy).toISOString(),
        notes,
      });
      setMessage('Emergency request broadcasted.');
      setUnitsNeeded(1);
      setRequiredBy(defaultRequiredBy());
      setNotes('');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to broadcast emergency request.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Emergency Requests</h1>
        <p className="text-sm text-muted">High-priority requests with quick action and broadcast alerts.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Emergency Blood Group
          <select className="legacy-input mt-1" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}>
            {bloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Units Needed
          <input
            className="legacy-input mt-1"
            min={1}
            required
            type="number"
            value={unitsNeeded}
            onChange={(e) => setUnitsNeeded(Number(e.target.value))}
          />
        </label>
        <label className="text-sm font-semibold">
          Required By
          <input
            className="legacy-input mt-1"
            required
            type="datetime-local"
            value={requiredBy}
            onChange={(e) => setRequiredBy(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Location
          <input className="legacy-input mt-1" required type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Emergency Notes
          <textarea className="legacy-input mt-1 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" disabled={submitting} type="submit">
          {submitting ? 'Broadcasting...' : 'Broadcast Emergency Alert'}
        </button>
        {message ? <p className="text-sm text-primary md:col-span-2">{message}</p> : null}
      </form>
    </section>
  );
}

