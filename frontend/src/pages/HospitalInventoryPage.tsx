import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { confirmedBloodGroups } from '../constants/blood-groups';
import {
  BloodGroup,
  InventoryChangeType,
  InventoryLogItem,
  createInventoryLog,
  getHospitalInventory,
  getInventoryLogs,
  upsertHospitalInventory,
} from '../services/hospital-portal';
import { FilterBox, Pager } from '../components/TableControls';
import { getInventoryStatus } from '../utils/inventory-status';

export default function HospitalInventoryPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialFilter = searchParams.get('filter') === 'expiring-soon' ? 'expiring-soon' : 'all';
  const [bloodGroup, setBloodGroup] = useState<BloodGroup>('O_POS');
  const [availableUnits, setAvailableUnits] = useState(0);
  const [stockCorrectionReason, setStockCorrectionReason] = useState('');
  const [logBloodGroup, setLogBloodGroup] = useState<BloodGroup>('O_POS');
  const [logType, setLogType] = useState<InventoryChangeType>('ADDED');
  const [logUnits, setLogUnits] = useState(1);
  const [logReason, setLogReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [items, setItems] = useState<Array<{ id: string; bloodGroup: BloodGroup; availableUnits: number; expiringUnits?: number; lastUpdated: string }>>(
    [],
  );
  const [logs, setLogs] = useState<InventoryLogItem[]>([]);
  const [logsPage, setLogsPage] = useState(0);
  const [hasMoreLogs, setHasMoreLogs] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [inventoryFilter, setInventoryFilter] = useState<'all' | 'expiring-soon'>(initialFilter);
  const pageSize = 50;

  const loadInventory = async (nextPage = logsPage) => {
    const [inventoryData, inventoryLogs] = await Promise.all([
      getHospitalInventory({ skip: 0, take: 200 }),
      getInventoryLogs({ skip: nextPage * pageSize, take: pageSize }),
    ]);
    setItems(inventoryData);
    setLogs(inventoryLogs);
    setHasMoreLogs(inventoryLogs.length === pageSize);
  };

  useEffect(() => {
    void loadInventory();
  }, [logsPage]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filteredItems = useMemo(
    () =>
      items
        .filter((item) => inventoryFilter !== 'expiring-soon' || Number(item.expiringUnits ?? 0) > 0)
        .filter(
          (item) =>
            !searchTerm ||
            item.bloodGroup.toLowerCase().includes(searchTerm) ||
            String(item.availableUnits).includes(searchTerm) ||
            String(item.expiringUnits ?? 0).includes(searchTerm),
        ),
    [items, inventoryFilter, searchTerm],
  );

  const updateInventoryFilter = (nextFilter: 'all' | 'expiring-soon') => {
    setInventoryFilter(nextFilter);
    const nextParams = new URLSearchParams(searchParams);
    if (nextFilter === 'expiring-soon') {
      nextParams.set('filter', 'expiring-soon');
    } else {
      nextParams.delete('filter');
    }
    setSearchParams(nextParams, { replace: true });
  };

  const filteredLogs = useMemo(
    () =>
      logs.filter(
        (log) =>
          !searchTerm ||
          log.inventory.bloodGroup.toLowerCase().includes(searchTerm) ||
          log.changeType.toLowerCase().includes(searchTerm) ||
          (log.reason ?? '').toLowerCase().includes(searchTerm),
      ),
    [logs, searchTerm],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    if (!stockCorrectionReason.trim()) {
      setMessage('Enter an adjustment reason before correcting the current stock level.');
      setSaving(false);
      return;
    }
    try {
      await upsertHospitalInventory({ bloodGroup, availableUnits: Number(availableUnits), reason: stockCorrectionReason.trim() });
      setMessage('Current stock level saved and logged successfully.');
      setStockCorrectionReason('');
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
    if (!logReason.trim()) {
      setMessage('Enter a reason or reference before recording an inventory movement.');
      return;
    }
    try {
      let item = items.find((entry) => entry.bloodGroup === logBloodGroup);
      if (!item) {
        item = await upsertHospitalInventory({ bloodGroup: logBloodGroup, availableUnits: 0, reason: 'Initialised for inventory movement' });
      }
      await createInventoryLog(item.id, {
        changeType: logType,
        unitsChanged: Number(logUnits),
        reason: logReason.trim(),
      });
      setMessage('Inventory movement recorded.');
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
      <FilterBox
        label="Filter inventory/logs (debounced)"
        placeholder="Filter by blood group, units, reason, change type..."
        value={searchInput}
        onChange={setSearchInput}
      />

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-primary">Inventory View</p>
          <p className="text-xs text-muted">
            Available units are the Inventory module source of truth. Expiring soon uses the existing inventory warning window and aggregate expiring-unit field.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            className={`rounded-lg px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
              inventoryFilter === 'all' ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => updateInventoryFilter('all')}
            type="button"
          >
            All
          </button>
          <button
            className={`rounded-lg px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
              inventoryFilter === 'expiring-soon' ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => updateInventoryFilter('expiring-soon')}
            type="button"
          >
            Expiring Soon
          </button>
        </div>
      </div>

      <form className="card grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <div className="md:col-span-2">
          <h2 className="text-lg font-bold text-primary">Current Inventory / Stock Adjustment</h2>
          <p className="text-sm text-muted">Use this for initial setup or controlled correction of the current stock level. Every correction is recorded in the inventory log.</p>
        </div>
        <label className="text-sm font-semibold">
          Blood Group
          <select className="legacy-input mt-1" value={bloodGroup} onChange={(e) => setBloodGroup(e.target.value as BloodGroup)}>
            {confirmedBloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          New Available Unit Count
          <input
            className="legacy-input mt-1"
            min={0}
            required
            type="number"
            value={availableUnits}
            onChange={(e) => setAvailableUnits(Number(e.target.value))}
          />
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Adjustment Reason
          <input
            className="legacy-input mt-1"
            required
            type="text"
            value={stockCorrectionReason}
            onChange={(e) => setStockCorrectionReason(e.target.value)}
            placeholder="Initial count, physical count correction, reconciled stock count..."
          />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" disabled={saving} type="submit">
          {saving ? 'Saving...' : 'Set Current Stock'}
        </button>
        {message ? <p className="text-sm text-primary md:col-span-2">{message}</p> : null}
      </form>

      <div className="card overflow-x-auto">
        <h2 className="text-lg font-bold text-primary">Current Levels</h2>
        {filteredItems.length === 0 ? (
          <p className="mt-2 text-sm text-muted">
            {inventoryFilter === 'expiring-soon'
              ? 'No usable blood units are approaching expiry within the configured warning period.'
              : 'No inventory records yet. Add the first blood stock entry to start monitoring current levels.'}
          </p>
        ) : (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4">Blood Group</th>
                <th className="py-2 pr-4">Units</th>
                <th className="py-2 pr-4">Expiring Soon</th>
                <th className="py-2 pr-4">Status</th>
                <th className="py-2 pr-4">Last Updated</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => {
                const status = getInventoryStatus(item.bloodGroup, item.availableUnits);
                return (
                  <tr key={item.id} className="border-b last:border-b-0">
                    <td className="py-2 pr-4">{confirmedBloodGroups.find((group) => group.value === item.bloodGroup)?.label ?? item.bloodGroup}</td>
                    <td className="py-2 pr-4 font-bold">{item.availableUnits}</td>
                    <td className="py-2 pr-4 font-bold">{item.expiringUnits ?? 0}</td>
                    <td className="py-2 pr-4">
                      <span className={`rounded-full border px-2 py-1 text-xs font-bold ${status.className}`}>{status.label}</span>
                    </td>
                    <td className="py-2 pr-4">{new Date(item.lastUpdated).toLocaleString()}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <form className="card grid gap-3 md:grid-cols-4" onSubmit={submitLog}>
        <div className="md:col-span-4">
          <h2 className="text-lg font-bold text-primary">Record Inventory Movement</h2>
          <p className="text-sm text-muted">Use this for operational movements. Current Levels and Inventory Logs update together from the same inventory record.</p>
        </div>
        <label className="text-sm font-semibold">
          Blood Group
          <select className="legacy-input mt-1" value={logBloodGroup} onChange={(e) => setLogBloodGroup(e.target.value as BloodGroup)} required>
            {confirmedBloodGroups.map((group) => (
              <option key={group.value} value={group.value}>
                {group.label} ({items.find((item) => item.bloodGroup === group.value)?.availableUnits ?? 0} units)
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
          Reason or Reference
          <input className="legacy-input mt-1" required type="text" value={logReason} onChange={(e) => setLogReason(e.target.value)} />
        </label>
        <button className="btn-primary md:col-span-4 md:w-fit" type="submit">
          Record Inventory Movement
        </button>

        <div className="md:col-span-4 overflow-x-auto">
          {filteredLogs.length === 0 ? (
            <p className="text-sm text-muted">No log entries yet. Stock additions, usage, expiry, and adjustments will appear here.</p>
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
                {filteredLogs.map((log) => (
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
          <Pager
            page={logsPage}
            hasMore={hasMoreLogs}
            onPrev={() => setLogsPage((value) => Math.max(0, value - 1))}
            onNext={() => setLogsPage((value) => value + 1)}
          />
        </div>
      </form>
    </section>
  );
}
