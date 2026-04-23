import { FormEvent, useEffect, useState } from 'react';
import { bloodGroups } from '../constants/blood-groups';
import {
  BloodGroup,
  InventoryChangeType,
  InventoryLogItem,
  createInventoryLog,
  getHospitalInventory,
  getInventoryLogs,
  upsertHospitalInventory,
} from '../services/hospital-portal';

export default function HospitalInventoryPage() {
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POS');
  const [availableUnits, setAvailableUnits] = useState(0);
  const [logInventoryId, setLogInventoryId] = useState('');
  const [logType, setLogType] = useState<InventoryChangeType>('ADDED');
  const [logUnits, setLogUnits] = useState(1);
  const [logReason, setLogReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Array<{ id: string; bloodGroup: BloodGroup; availableUnits: number; lastUpdated: string }>>(
    [],
  );
  const [logs, setLogs] = useState<InventoryLogItem[]>([]);

  const loadInventory = async () => {
    const [inventoryData, inventoryLogs] = await Promise.all([getHospitalInventory(), getInventoryLogs()]);
    setItems(inventoryData);
    setLogs(inventoryLogs);
    if (!logInventoryId && inventoryData[0]?.id) {
      setLogInventoryId(inventoryData[0].id);
    }
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

  const submitLog = async (event: FormEvent) => {
    event.preventDefault();
    setMessage('');
    if (!logInventoryId) {
      setMessage('Choose an inventory item before adding a log.');
      return;
    }
    try {
      await createInventoryLog(logInventoryId, {
        changeType: logType,
        unitsChanged: Number(logUnits),
        reason: logReason || undefined,
      });
      setMessage('Inventory log added.');
      setLogUnits(1);
      setLogReason('');
      await loadInventory();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to add inventory log.');
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

      <form className="card grid gap-3 md:grid-cols-4" onSubmit={submitLog}>
        <h2 className="text-lg font-bold text-primary md:col-span-4">Inventory Logs</h2>
        <label className="text-sm font-semibold">
          Inventory Item
          <select className="legacy-input mt-1" value={logInventoryId} onChange={(e) => setLogInventoryId(e.target.value)} required>
            <option value="" disabled>
              Select
            </option>
            {items.map((item) => (
              <option key={item.id} value={item.id}>
                {item.bloodGroup} ({item.availableUnits} units)
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Change Type
          <select className="legacy-input mt-1" value={logType} onChange={(e) => setLogType(e.target.value as InventoryChangeType)}>
            {(['ADDED', 'USED', 'EXPIRED', 'ADJUSTED'] as InventoryChangeType[]).map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Units Changed
          <input
            className="legacy-input mt-1"
            min={0}
            required
            type="number"
            value={logUnits}
            onChange={(e) => setLogUnits(Number(e.target.value))}
          />
        </label>
        <label className="text-sm font-semibold">
          Reason
          <input className="legacy-input mt-1" type="text" value={logReason} onChange={(e) => setLogReason(e.target.value)} />
        </label>
        <button className="btn-primary md:col-span-4 md:w-fit" type="submit">
          Add Log Entry
        </button>

        <div className="md:col-span-4 overflow-x-auto">
          {logs.length === 0 ? (
            <p className="text-sm text-muted">No log entries yet.</p>
          ) : (
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="border-b">
                  <th className="py-2 pr-4">Blood Group</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4">Units</th>
                  <th className="py-2 pr-4">Reason</th>
                  <th className="py-2 pr-4">At</th>
                </tr>
              </thead>
              <tbody>
                {logs.slice(0, 20).map((log) => (
                  <tr key={log.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{log.inventory.bloodGroup}</td>
                    <td className="py-2 pr-4">{log.changeType}</td>
                    <td className="py-2 pr-4">
                      {log.previousUnits} to {log.newUnits}
                    </td>
                    <td className="py-2 pr-4">{log.reason ?? '-'}</td>
                    <td className="py-2 pr-4">{new Date(log.createdAt).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </form>
    </section>
  );
}
