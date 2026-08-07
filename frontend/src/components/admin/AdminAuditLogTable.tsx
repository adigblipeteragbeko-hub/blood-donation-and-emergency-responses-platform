import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getAdminAuditLogs, type AuditLogItem } from '../../services/admin-dashboard';

type AuditLogResponse = {
  total: number;
  items: AuditLogItem[];
  users: Array<{ id: string; email: string; role?: string }>;
};

type AuditFilters = {
  action: string;
  userId: string;
  module: string;
  from: string;
  to: string;
  skip: number;
  take: number;
};

const DEFAULT_FILTERS: AuditFilters = {
  action: '',
  userId: '',
  module: '',
  from: '',
  to: '',
  skip: 0,
  take: 20,
};

const ACTION_LABELS: Record<string, string> = {
  LOGIN: 'User logged in',
  DONOR_MOBILIZATION_SENT: 'Donor mobilisation campaign launched',
  APPOINTMENT_COMPLETED: 'Appointment completed',
  INVENTORY_UPDATED: 'Blood inventory updated',
  EMERGENCY_REQUEST_CREATED: 'Emergency request created',
};

const SENSITIVE_KEYS = /password|token|secret|signature|coordinate|latitude|longitude|medical|clinical/i;

const formatDateTime = (value?: string | null) => {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
};

const formatRole = (value?: string | null) => (value ? value.replace(/_/g, ' ') : 'AUTOMATION');

const readableAction = (action: string) =>
  ACTION_LABELS[action] ?? action.replace(/_/g, ' ').toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());

const safeJson = (value: unknown) => {
  if (!value) return '';
  const sanitize = (input: unknown): unknown => {
    if (Array.isArray(input)) return input.map(sanitize);
    if (!input || typeof input !== 'object') return input;
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, entry]) => [
        key,
        SENSITIVE_KEYS.test(key) ? '[redacted]' : sanitize(entry),
      ]),
    );
  };
  return JSON.stringify(sanitize(value), null, 2);
};

function campaignDescription(item: AuditLogItem) {
  if (item.action !== 'DONOR_MOBILIZATION_SENT') return item.description ?? '';
  const metadata = (item.metadata ?? {}) as Record<string, unknown>;
  const hospital = String(metadata.hospitalName ?? 'the hospital');
  const bloodGroup = String(metadata.bloodGroup ?? '').replace('_POS', '+').replace('_NEG', '-');
  const notified = Number(metadata.notificationsCreated ?? metadata.targetDonorCount ?? 0);
  return item.description ?? `Hospital Admin at ${hospital} launched a ${bloodGroup} donor mobilisation campaign. ${notified} eligible compatible donor${notified === 1 ? '' : 's'} were notified.`;
}

export function AdminAuditLogTable({
  mode = 'full',
  compactDensity = false,
}: {
  mode?: 'preview' | 'full';
  compactDensity?: boolean;
}) {
  const [filters, setFilters] = useState<AuditFilters>({ ...DEFAULT_FILTERS, take: mode === 'preview' ? 6 : 20 });
  const [data, setData] = useState<AuditLogResponse>({ total: 0, items: [], users: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<AuditLogItem | null>(null);

  const loadAuditLogs = async () => {
    try {
      setLoading(true);
      setError('');
      const next = await getAdminAuditLogs(filters);
      setData(next);
    } catch {
      setError('Unable to load audit logs. Please retry.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadAuditLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  const pageStart = data.total ? Math.min(filters.skip + 1, data.total) : 0;
  const pageEnd = Math.min(filters.skip + filters.take, data.total);

  return (
    <div className="space-y-4">
      {mode === 'full' ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          <input
            value={filters.action}
            onChange={(event) => setFilters((current) => ({ ...current, action: event.target.value, skip: 0 }))}
            placeholder="Action"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          />
          <select
            value={filters.userId}
            onChange={(event) => setFilters((current) => ({ ...current, userId: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          >
            <option value="">All users</option>
            {data.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.email}{user.role ? ` (${formatRole(user.role)})` : ''}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((current) => ({ ...current, from: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          />
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((current) => ({ ...current, to: event.target.value, skip: 0 }))}
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          />
          <input
            value={filters.module}
            onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value, skip: 0 }))}
            placeholder="Module or entity"
            className="rounded-2xl border border-slate-200 px-4 py-3 text-sm font-medium text-slate-700"
          />
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm font-semibold text-slate-600">Recent real audit activity, newest first.</p>
          <Link className="rounded-full border border-red-200 px-4 py-2 text-sm font-black text-primary transition hover:bg-red-50" to="/admin/management?section=audit">
            View All Audit Logs
          </Link>
        </div>
      )}

      {error ? (
        <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-sm font-semibold text-red-700">
          <p>{error}</p>
          <button className="mt-2 rounded-xl border border-red-200 px-3 py-2 text-xs font-black" onClick={() => void loadAuditLogs()} type="button">
            Retry
          </button>
        </div>
      ) : null}

      {loading ? <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">Loading audit logs...</p> : null}

      {!loading && !error && data.items.length === 0 ? (
        <p className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-600">No audit records match the selected filters.</p>
      ) : null}

      {data.items.length > 0 ? (
        <div className="overflow-auto rounded-3xl border border-slate-100">
          <table className={`min-w-[980px] w-full bg-white text-left ${compactDensity ? 'text-xs' : 'text-sm'}`}>
            <thead className="bg-slate-50 text-xs uppercase tracking-[0.22em] text-slate-400">
              <tr>
                <th className="px-4 py-4">User</th>
                <th className="px-4 py-4">Action</th>
                <th className="px-4 py-4">Entity / Module</th>
                <th className="px-4 py-4">Description</th>
                <th className="px-4 py-4">IP</th>
                <th className="px-4 py-4">Timestamp</th>
                <th className="px-4 py-4">Details</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((item) => (
                <tr key={item.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">{item.actor?.email ?? 'System'}</p>
                    <p className="text-xs text-slate-500">{formatRole(item.actor?.role)}</p>
                  </td>
                  <td className="px-4 py-4">
                    <p className="font-semibold text-slate-900">{readableAction(item.action)}</p>
                    <p className="text-xs text-slate-500">{item.action}</p>
                  </td>
                  <td className="px-4 py-4 text-slate-600">
                    <p>{item.entityType}{item.entityId ? ` - ${item.entityId}` : ''}</p>
                    <p className="text-xs text-slate-500">{item.module ?? 'GENERAL'}</p>
                  </td>
                  <td className="max-w-md px-4 py-4 text-slate-600">{campaignDescription(item) || 'No description recorded.'}</td>
                  <td className="px-4 py-4 text-slate-600">{item.ipAddress ?? '-'}</td>
                  <td className="px-4 py-4 text-slate-600">{formatDateTime(item.createdAt)}</td>
                  <td className="px-4 py-4">
                    <button className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:bg-slate-50" onClick={() => setSelected(item)} type="button">
                      View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {mode === 'full' ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-slate-500">
            Showing <span className="font-semibold text-slate-900">{pageStart}</span>-<span className="font-semibold text-slate-900">{pageEnd}</span> of{' '}
            <span className="font-semibold text-slate-900">{data.total}</span>
          </p>
          <div className="flex gap-2">
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" disabled={filters.skip === 0} onClick={() => setFilters((current) => ({ ...current, skip: Math.max(current.skip - current.take, 0) }))} type="button">
              Previous
            </button>
            <button className="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50" disabled={filters.skip + filters.take >= data.total} onClick={() => setFilters((current) => ({ ...current, skip: current.skip + current.take }))} type="button">
              Next
            </button>
          </div>
        </div>
      ) : null}

      {selected ? (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/45 px-4 py-6" role="dialog" aria-modal="true" aria-labelledby="audit-detail-title">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-3xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.25em] text-primary">Audit Details</p>
                <h2 id="audit-detail-title" className="mt-1 text-xl font-black text-slate-950">{readableAction(selected.action)}</h2>
                <p className="mt-1 text-sm text-slate-600">{campaignDescription(selected) || selected.action}</p>
              </div>
              <button className="rounded-full border border-slate-200 px-3 py-2 text-xs font-black text-slate-600" onClick={() => setSelected(null)} type="button">
                Close
              </button>
            </div>
            <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <Info label="Actor" value={selected.actor?.email ?? 'System'} />
              <Info label="Role" value={formatRole(selected.actor?.role)} />
              <Info label="Raw Action" value={selected.action} />
              <Info label="Entity" value={`${selected.entityType}${selected.entityId ? ` - ${selected.entityId}` : ''}`} />
              <Info label="Module" value={selected.module ?? 'GENERAL'} />
              <Info label="Timestamp" value={formatDateTime(selected.createdAt)} />
              <Info label="IP Address" value={selected.ipAddress ?? 'Not recorded'} />
            </div>
            {safeJson(selected.metadata) ? <JsonBlock label="Metadata" value={safeJson(selected.metadata)} /> : null}
            {safeJson(selected.oldValue) ? <JsonBlock label="Old Value" value={safeJson(selected.oldValue)} /> : null}
            {safeJson(selected.newValue) ? <JsonBlock label="New Value" value={safeJson(selected.newValue)} /> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
      <p className="text-xs font-black uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 break-words font-semibold text-slate-800">{value}</p>
    </div>
  );
}

function JsonBlock({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-950 p-4">
      <p className="text-xs font-black uppercase tracking-wide text-slate-300">{label}</p>
      <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap text-xs text-slate-100">{value}</pre>
    </div>
  );
}
