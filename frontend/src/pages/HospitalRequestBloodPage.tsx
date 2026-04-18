import { FormEvent, useEffect, useState } from 'react';
import { bloodGroups } from '../constants/blood-groups';
import { BloodGroup, PriorityLevel, createHospitalRequest, getHospitalProfile } from '../services/hospital-portal';

function defaultRequiredBy() {
  const date = new Date();
  date.setHours(date.getHours() + 12);
  return date.toISOString().slice(0, 16);
}

export default function HospitalRequestBloodPage() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POS');
  const [unitsNeeded, setUnitsNeeded] = useState(1);
  const [priority, setPriority] = useState<PriorityLevel>('MEDIUM');
  const [location, setLocation] = useState('');
  const [requiredBy, setRequiredBy] = useState(defaultRequiredBy());
  const [notes, setNotes] = useState('');
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        const profile = await getHospitalProfile();
        setLocation(profile.location ?? '');
      } catch {
        // keep empty; user can type location
      }
    };
    void load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await createHospitalRequest({
        bloodGroup,
        unitsNeeded,
        type: 'STANDARD',
        priority,
        location,
        requiredBy: new Date(requiredBy).toISOString(),
        notes,
      });
      setMessage('Blood request created successfully.');
      setUnitsNeeded(1);
      setPriority('MEDIUM');
      setRequiredBy(defaultRequiredBy());
      setNotes('');
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to create request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Request Blood</h1>
        <p className="text-sm text-muted">Create new blood requests with quantity, urgency, and patient details.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2" onSubmit={submit}>
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
          Priority
          <select className="legacy-input mt-1" value={priority} onChange={(e) => setPriority(e.target.value as PriorityLevel)}>
            <option value="LOW">LOW</option>
            <option value="MEDIUM">MEDIUM</option>
            <option value="HIGH">HIGH</option>
            <option value="CRITICAL">CRITICAL</option>
          </select>
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
        <label className="text-sm font-semibold md:col-span-2">
          Location
          <input className="legacy-input mt-1" required type="text" value={location} onChange={(e) => setLocation(e.target.value)} />
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Patient / Clinical Notes
          <textarea className="legacy-input mt-1 min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" disabled={saving} type="submit">
          {saving ? 'Submitting...' : 'Submit Blood Request'}
        </button>
        {message ? <p className="text-sm text-primary md:col-span-2">{message}</p> : null}
      </form>
    </section>
  );
}

