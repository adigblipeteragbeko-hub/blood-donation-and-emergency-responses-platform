import { FormEvent, useEffect, useState } from 'react';
import { bloodGroups } from '../constants/blood-groups';
import { BloodGroup, getHospitalInventory, upsertHospitalInventory } from '../services/hospital-portal';

export default function HospitalInventoryPage() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POS');
  const [availableUnits, setAvailableUnits] = useState(0);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Array<{ id: string; bloodGroup: BloodGroup; availableUnits: number; lastUpdated: string }>>(
    [],
  );

  const loadInventory = async () => {
    const data = await getHospitalInventory();
    setItems(data);
  };

  useEffect(() => {
    void loadInventory();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await upsertHospitalInventory({ bloodGroup, availableUnits: Number(availableUnits) });
      setMessage('Inventory saved successfully.');
      await loadInventory();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to save inventory.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Blood Inventory</h1>
        <p className="text-sm text-muted">Manage blood units, view levels, and track last updates.</p>
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
          Available Units
          <input
            className="legacy-input mt-1"
            min={0}
            required
            type="number"
            value={availableUnits}
            onChange={(e) => setAvailableUnits(Number(e.target.value))}
          />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" disabled={saving} type="submit">
          {saving ? 'Saving...' : 'Save Inventory'}
        </button>
        {message ? <p className="text-sm text-primary md:col-span-2">{message}</p> : null}
      </form>

      <div className="card overflow-x-auto">
        <h2 className="text-lg font-bold text-primary">Current Levels</h2>
        {items.length === 0 ? (
          <p className="mt-2 text-sm text-muted">No inventory records yet.</p>
        ) : (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4">Blood Group</th>
                <th className="py-2 pr-4">Units</th>
                <th className="py-2 pr-4">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-4">{bloodGroups.find((group) => group.value === item.bloodGroup)?.label ?? item.bloodGroup}</td>
                  <td className="py-2 pr-4">{item.availableUnits}</td>
                  <td className="py-2 pr-4">{new Date(item.lastUpdated).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

