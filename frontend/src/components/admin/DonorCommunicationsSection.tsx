import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import {
  DonorCommunicationFilters,
  DonorContactItem,
  SmsPreviewResponse,
  exportDonorContacts,
  getDonorCommunicationDonors,
  getDonorSmsCampaigns,
  launchDonorSmsCampaign,
  previewDonorSms,
  type SmsCampaignItem,
} from '../../services/admin-donor-communications';

const bloodGroups = ['', 'O_POS', 'O_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'AB_POS', 'AB_NEG'];
const exportFields = [
  ['name', 'Full name'],
  ['phone', 'Phone'],
  ['email', 'Email'],
  ['bloodGroup', 'Blood Group'],
  ['region', 'Region'],
  ['city', 'City'],
  ['hospital', 'Preferred hospital'],
  ['lastDonationDate', 'Last donation date'],
  ['eligibilityStatus', 'Eligibility status'],
];

const defaultMessage = 'BloodSOS: Your donation can help save lives. Please log in to check eligibility and schedule a donation.';

function cleanFilters(filters: DonorCommunicationFilters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== undefined)) as DonorCommunicationFilters;
}

function formatDate(value?: string | null) {
  if (!value) return 'Never';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Unavailable' : date.toLocaleDateString();
}

export function DonorCommunicationsSection() {
  const { user } = useAuth();
  const [filters, setFilters] = useState<DonorCommunicationFilters>({ take: 25, skip: 0 });
  const [data, setData] = useState<{ items: DonorContactItem[]; total: number; summary: { smsEnabledCount: number; validPhoneCount: number; excludedCount: number } }>({
    items: [],
    total: 0,
    summary: { smsEnabledCount: 0, validPhoneCount: 0, excludedCount: 0 },
  });
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [selectAllFiltered, setSelectAllFiltered] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showSmsModal, setShowSmsModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [smsName, setSmsName] = useState('Donor SMS Campaign');
  const [smsMessage, setSmsMessage] = useState(defaultMessage);
  const [confirmationText, setConfirmationText] = useState('');
  const [smsPreview, setSmsPreview] = useState<SmsPreviewResponse | null>(null);
  const [submittingSms, setSubmittingSms] = useState(false);
  const [exportScope, setExportScope] = useState<'selected' | 'filtered'>('selected');
  const [selectedFields, setSelectedFields] = useState<string[]>(exportFields.map(([value]) => value));
  const [campaigns, setCampaigns] = useState<SmsCampaignItem[]>([]);

  const activeFilters = useMemo(() => cleanFilters({ ...filters, skip: undefined, take: undefined }), [filters]);
  const selectionMode = selected.size > 0 ? 'EXPLICIT' : selectAllFiltered ? 'FILTERED' : 'EXPLICIT';
  const selectedCount = selected.size > 0 ? selected.size : selectAllFiltered ? data.total : 0;
  const estimatedParts = smsMessage.length <= 160 ? 1 : Math.ceil(smsMessage.length / 153);

  const load = async () => {
    if (user?.role !== 'ADMIN') return;
    setLoading(true);
    setError('');
    try {
      const [donorsPayload, campaignsPayload] = await Promise.all([
        getDonorCommunicationDonors(cleanFilters(filters)),
        getDonorSmsCampaigns({ take: 5 }),
      ]);
      setData(donorsPayload);
      setCampaigns(campaignsPayload.items ?? []);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Unable to load donor communications.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [filters.skip, filters.take]);

  if (user?.role !== 'ADMIN') {
    return (
      <div className="card">
        <h2 className="text-xl font-bold text-slate-900">403 Forbidden</h2>
        <p className="mt-2 text-sm text-slate-600">Only platform administrators can access donor communications.</p>
      </div>
    );
  }

  const updateFilter = (key: keyof DonorCommunicationFilters, value: string) => {
    setFilters((current) => ({ ...current, [key]: value, skip: 0 }));
    setSelectAllFiltered(false);
  };

  const submitFilters = (event: FormEvent) => {
    event.preventDefault();
    void load();
  };

  const toggleSelected = (id: string) => {
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setSelectAllFiltered(false);
    setSmsPreview(null);
  };

  const previewSms = async () => {
    setError('');
    setSuccess('');
    try {
      const payload = {
        selectionMode,
        donorIds: selectionMode === 'EXPLICIT' ? [...selected] : undefined,
        filters: selectionMode === 'FILTERED' ? activeFilters : undefined,
        message: smsMessage,
      } as const;
      setSmsPreview(await previewDonorSms(payload));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Unable to preview SMS campaign.');
    }
  };

  const sendCampaign = async () => {
    if (submittingSms) return;
    setSubmittingSms(true);
    setError('');
    try {
      const result = await launchDonorSmsCampaign({
        name: smsName,
        selectionMode,
        donorIds: selectionMode === 'EXPLICIT' ? [...selected] : undefined,
        filters: selectionMode === 'FILTERED' ? activeFilters : undefined,
        message: smsMessage,
        confirmationText,
      });
      setSuccess(`Campaign launched. Sent ${result.sent}, failed ${result.failed}, skipped ${result.skipped}.`);
      setShowSmsModal(false);
      setConfirmationText('');
      setSmsPreview(null);
      await load();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Unable to launch SMS campaign.');
    } finally {
      setSubmittingSms(false);
    }
  };

  const downloadExport = async () => {
    setError('');
    try {
      const result = await exportDonorContacts({
        format: 'csv',
        fields: selectedFields,
        donorIds: exportScope === 'selected' ? [...selected] : undefined,
        filters: exportScope === 'filtered' ? activeFilters : undefined,
      });
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      link.click();
      URL.revokeObjectURL(url);
      setShowExportModal(false);
      setSuccess('Donor contact export downloaded.');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? 'Unable to export donor contacts.');
    }
  };

  return (
    <div id="donor-communications" className="space-y-5">
      {error && <p className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded bg-green-50 p-3 text-sm text-green-700">{success}</p>}

      <form className="card space-y-4" onSubmit={submitFilters}>
        <div>
          <h2 className="text-xl font-semibold">Donor Communications</h2>
          <p className="text-sm text-muted">Filter donor contacts, export approved fields, and launch consent-based SMS campaigns.</p>
        </div>
        <div className="grid gap-3 md:grid-cols-4">
          <input className="rounded border p-2" placeholder="Name, email, or phone" value={filters.search ?? ''} onChange={(e) => updateFilter('search', e.target.value)} />
          <select className="rounded border p-2" value={filters.bloodGroup ?? ''} onChange={(e) => updateFilter('bloodGroup', e.target.value)}>
            {bloodGroups.map((group) => <option key={group || 'all'} value={group}>{group || 'All blood groups'}</option>)}
          </select>
          <input className="rounded border p-2" placeholder="Region" value={filters.region ?? ''} onChange={(e) => updateFilter('region', e.target.value)} />
          <input className="rounded border p-2" placeholder="City" value={filters.city ?? ''} onChange={(e) => updateFilter('city', e.target.value)} />
          <select className="rounded border p-2" value={filters.eligibilityStatus ?? ''} onChange={(e) => updateFilter('eligibilityStatus', e.target.value)}>
            <option value="">Any eligibility</option>
            <option value="APPROVED">Approved</option>
            <option value="PENDING">Pending</option>
          </select>
          <select className="rounded border p-2" value={filters.accountStatus ?? ''} onChange={(e) => updateFilter('accountStatus', e.target.value)}>
            <option value="">Any account status</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
          <select className="rounded border p-2" value={filters.smsEnabled ?? ''} onChange={(e) => updateFilter('smsEnabled', e.target.value)}>
            <option value="">Any SMS consent</option>
            <option value="true">SMS enabled</option>
            <option value="false">SMS disabled</option>
          </select>
          <select className="rounded border p-2" value={String(filters.take ?? 25)} onChange={(e) => setFilters((current) => ({ ...current, take: Number(e.target.value), skip: 0 }))}>
            <option value="25">25 per page</option>
            <option value="50">50 per page</option>
            <option value="100">100 per page</option>
          </select>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={filters.neverDonated === 'true'} onChange={(e) => updateFilter('neverDonated', e.target.checked ? 'true' : '')} />
            Never donated
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-slate-700">
            <input type="checkbox" checked={filters.reminderDue === 'true'} onChange={(e) => updateFilter('reminderDue', e.target.checked ? 'true' : '')} />
            Reminder due
          </label>
          <input className="rounded border p-2" type="date" value={filters.lastDonationFrom ?? ''} onChange={(e) => updateFilter('lastDonationFrom', e.target.value)} />
          <input className="rounded border p-2" type="date" value={filters.lastDonationTo ?? ''} onChange={(e) => updateFilter('lastDonationTo', e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-2">
          <button className="btn-primary" type="submit">{loading ? 'Loading...' : 'Apply filters'}</button>
          <button className="rounded border px-4 py-2 text-sm font-semibold" type="button" onClick={() => { setFilters({ take: 25, skip: 0 }); setSelected(new Set()); setSelectAllFiltered(false); }}>
            Clear filters
          </button>
        </div>
      </form>

      <div className="grid gap-3 md:grid-cols-5">
        <div className="card"><p className="text-xs uppercase text-muted">Matching donors</p><p className="text-2xl font-bold">{data.total}</p></div>
        <div className="card"><p className="text-xs uppercase text-muted">Selected</p><p className="text-2xl font-bold">{selectedCount}</p></div>
        <div className="card"><p className="text-xs uppercase text-muted">Valid SMS recipients</p><p className="text-2xl font-bold">{data.summary.validPhoneCount}</p></div>
        <div className="card"><p className="text-xs uppercase text-muted">Excluded</p><p className="text-2xl font-bold">{data.summary.excludedCount}</p></div>
        <div className="card"><p className="text-xs uppercase text-muted">Estimated credits</p><p className="text-2xl font-bold">{(smsPreview?.eligibleRecipients ?? data.summary.validPhoneCount) * estimatedParts}</p></div>
      </div>

      <div className="card space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap gap-2">
            <button className="rounded border px-3 py-2 text-sm font-semibold" type="button" onClick={() => { setSelected(new Set(data.items.map((item) => item.id))); setSelectAllFiltered(false); setSmsPreview(null); }}>
              Select current page
            </button>
            <button className="rounded border px-3 py-2 text-sm font-semibold" type="button" onClick={() => { setSelectAllFiltered(true); setSelected(new Set()); setSmsPreview(null); }}>
              Select all filtered
            </button>
            <button className="rounded border px-3 py-2 text-sm font-semibold" type="button" onClick={() => { setSelected(new Set()); setSelectAllFiltered(false); setSmsPreview(null); }}>
              Clear selection
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <button className="rounded border border-red-200 px-3 py-2 text-sm font-bold text-primary disabled:opacity-50" disabled={!selectedCount} type="button" onClick={() => setShowExportModal(true)}>
              Export contacts
            </button>
            <button className="btn-primary disabled:opacity-50" disabled={!selectedCount} type="button" onClick={() => setShowSmsModal(true)}>
              Send bulk SMS
            </button>
          </div>
        </div>
        <div className="overflow-auto rounded-xl border border-slate-100">
          <table className="min-w-[1100px] w-full text-left text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-3">Select</th>
                <th className="px-3 py-3">Donor</th>
                <th className="px-3 py-3">Blood</th>
                <th className="px-3 py-3">Region/City</th>
                <th className="px-3 py-3">Phone</th>
                <th className="px-3 py-3">Email</th>
                <th className="px-3 py-3">Eligibility</th>
                <th className="px-3 py-3">Account</th>
                <th className="px-3 py-3">Last donation</th>
                <th className="px-3 py-3">SMS</th>
                <th className="px-3 py-3">Preferred hospital</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((donor) => (
                <tr key={donor.id} className="border-t">
                  <td className="px-3 py-3"><input type="checkbox" checked={selected.has(donor.id)} onChange={() => toggleSelected(donor.id)} /></td>
                  <td className="px-3 py-3 font-semibold">{donor.fullName}</td>
                  <td className="px-3 py-3">{donor.bloodGroup}</td>
                  <td className="px-3 py-3">{[donor.region, donor.city].filter(Boolean).join(' / ') || 'Unavailable'}</td>
                  <td className="px-3 py-3">{donor.maskedPhone}</td>
                  <td className="px-3 py-3">{donor.maskedEmail}</td>
                  <td className="px-3 py-3">{donor.eligibilityStatus}</td>
                  <td className="px-3 py-3">{donor.accountStatus}</td>
                  <td className="px-3 py-3">{formatDate(donor.lastDonationDate)}</td>
                  <td className="px-3 py-3">{donor.smsEnabled ? 'Enabled' : 'Disabled'}</td>
                  <td className="px-3 py-3">{donor.preferredHospital ?? 'None'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between text-sm">
          <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={!filters.skip} onClick={() => setFilters((current) => ({ ...current, skip: Math.max(0, Number(current.skip ?? 0) - Number(current.take ?? 25)) }))}>Previous</button>
          <span>Showing {Number(filters.skip ?? 0) + 1}-{Math.min(Number(filters.skip ?? 0) + data.items.length, data.total)} of {data.total}</span>
          <button className="rounded border px-3 py-2 disabled:opacity-50" disabled={Number(filters.skip ?? 0) + data.items.length >= data.total} onClick={() => setFilters((current) => ({ ...current, skip: Number(current.skip ?? 0) + Number(current.take ?? 25) }))}>Next</button>
        </div>
      </div>

      <div className="card space-y-3">
        <h3 className="text-lg font-bold">Campaign history</h3>
        {campaigns.map((campaign) => (
          <div key={campaign.id} className="rounded border border-slate-100 p-3 text-sm">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="font-bold text-slate-900">{campaign.name}</p>
              <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{campaign.status}</span>
            </div>
            <p className="mt-1 text-slate-600">{campaign.message}</p>
            <p className="mt-2 text-xs text-slate-500">
              Sent {campaign.sentCount}, failed {campaign.failedCount}, skipped {campaign.skippedCount}, credits {campaign.creditUsed} · {formatDate(campaign.createdAt)}
            </p>
          </div>
        ))}
      </div>

      {showExportModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="w-full max-w-xl rounded bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold">Export donor contacts</h3>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {exportFields.map(([value, label]) => (
                <label key={value} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedFields.includes(value)} onChange={(e) => setSelectedFields((current) => e.target.checked ? [...current, value] : current.filter((item) => item !== value))} />
                  {label}
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-3 text-sm">
              <label><input type="radio" checked={exportScope === 'selected'} onChange={() => setExportScope('selected')} /> Export selected donors</label>
              <label><input type="radio" checked={exportScope === 'filtered'} onChange={() => setExportScope('filtered')} /> Export all filtered donors</label>
            </div>
            <p className="mt-3 text-sm text-slate-600">Records: {exportScope === 'filtered' ? data.total : selected.size}</p>
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border px-4 py-2" onClick={() => setShowExportModal(false)}>Cancel</button>
              <button className="btn-primary disabled:opacity-50" disabled={!selectedFields.length || (exportScope === 'selected' && !selected.size)} onClick={downloadExport}>Download CSV</button>
            </div>
          </div>
        </div>
      )}

      {showSmsModal && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded bg-white p-5 shadow-xl">
            <h3 className="text-lg font-bold">Send bulk SMS</h3>
            <p className="mt-1 text-sm text-amber-700">SMS credits will be consumed. For manual verification, send to one selected donor first.</p>
            <div className="mt-4 grid gap-3">
              <input className="rounded border p-2" value={smsName} onChange={(e) => setSmsName(e.target.value)} placeholder="Campaign name" />
              <textarea className="min-h-32 rounded border p-2" value={smsMessage} onChange={(e) => setSmsMessage(e.target.value)} maxLength={480} />
              <p className="text-xs text-slate-500">{smsMessage.length}/480 characters · {estimatedParts} SMS part(s) · Sender ID: BloodSOS · Selection: {selectAllFiltered ? 'all filtered donors' : `${selected.size} selected donors`}</p>
            </div>
            {smsPreview && (
              <div className="mt-4 rounded border border-slate-100 p-3 text-sm">
                <p className="font-bold">Preview summary</p>
                <p>Eligible: {smsPreview.eligibleRecipients} of {smsPreview.requestedDonors}. Estimated credits: {smsPreview.estimatedCredits}.</p>
                <p className="mt-1 text-slate-600">Excluded: {Object.entries(smsPreview.excluded).map(([key, value]) => `${key}: ${value}`).join(', ')}</p>
                <p className="mt-1 text-slate-600">Samples: {smsPreview.sampleRecipients.map((item) => `${item.donorName} (${item.maskedPhone})`).join(', ') || 'None'}</p>
              </div>
            )}
            <input className="mt-4 w-full rounded border p-2" placeholder="Type SEND to confirm" value={confirmationText} onChange={(e) => setConfirmationText(e.target.value)} />
            <div className="mt-5 flex justify-end gap-2">
              <button className="rounded border px-4 py-2" onClick={() => setShowSmsModal(false)}>Cancel</button>
              <button className="rounded border border-red-200 px-4 py-2 font-bold text-primary" onClick={previewSms}>Preview</button>
              <button className="btn-primary disabled:opacity-50" disabled={submittingSms || confirmationText !== 'SEND'} onClick={sendCampaign}>
                {submittingSms ? 'Sending...' : 'Send Campaign'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
