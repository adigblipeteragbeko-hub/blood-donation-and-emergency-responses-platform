import { FormEvent, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AppointmentItem,
  AppointmentStatus,
  AppointmentType,
  DonorMatch,
  createHospitalAppointment,
  getEligibleAppointmentDonors,
  getHospitalAppointments,
  completeHospitalAppointmentDonation,
  getAppointmentDonationNumberPreview,
  updateHospitalAppointmentStatus,
} from '../services/hospital-portal';
import { bloodGroups } from '../constants/blood-groups';
import { FilterBox, Pager } from '../components/TableControls';
import { TODAY_APPOINTMENT_STATUSES_INCLUDED, getTodayAppointmentQuery } from '../utils/appointment-date-filter';
import { useToast } from '../components/ui/ToastProvider';

const statusOptions: AppointmentStatus[] = [
  'SCHEDULED',
  'PENDING_CONFIRMATION',
  'CONFIRMED',
  'DONOR_ARRIVED',
  'IN_PROGRESS',
  'RESCHEDULE_REQUESTED',
  'RESCHEDULED',
  'DECLINED',
  'COMPLETED',
  'CANCELLED',
  'MISSED',
];
const appointmentTypes: Array<{ value: AppointmentType; label: string }> = [
  { value: 'BLOOD_DONATION', label: 'Blood Donation' },
  { value: 'ELIGIBILITY_SCREENING', label: 'Eligibility Screening' },
  { value: 'FOLLOW_UP', label: 'Follow-Up' },
  { value: 'EMERGENCY_DONATION', label: 'Emergency Donation' },
];

const typeLabel = (value?: AppointmentType) =>
  appointmentTypes.find((item) => item.value === value)?.label ?? 'Blood Donation';

const completionAllowedStatuses: AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED', 'DONOR_ARRIVED', 'IN_PROGRESS'];
const completionHiddenStatuses: AppointmentStatus[] = ['PENDING_CONFIRMATION', 'DECLINED', 'CANCELLED', 'NO_SHOW', 'COMPLETED'];
const terminalStatuses: AppointmentStatus[] = ['DECLINED', 'CANCELLED', 'COMPLETED', 'MISSED', 'NO_SHOW'];

const canCompleteAppointment = (item: AppointmentItem) =>
  item.appointmentType === 'BLOOD_DONATION' && !item.donationPostedAt && completionAllowedStatuses.includes(item.status);

const shouldHideCompletionPanel = (item: AppointmentItem) =>
  item.appointmentType !== 'BLOOD_DONATION' || item.donationPostedAt || completionHiddenStatuses.includes(item.status);

const statusChoicesFor = (status: AppointmentStatus): AppointmentStatus[] => {
  if (status === 'COMPLETED') return ['COMPLETED'];
  if (status === 'CANCELLED') return ['CANCELLED'];
  if (status === 'DECLINED') return ['DECLINED'];
  if (status === 'NO_SHOW') return ['NO_SHOW'];
  if (terminalStatuses.includes(status)) return [status];
  return statusOptions.filter((option) => {
    if (option === 'COMPLETED') return completionAllowedStatuses.includes(status);
    return true;
  });
};

function defaultScheduledAt() {
  const date = new Date();
  date.setHours(date.getHours() + 24);
  return date.toISOString().slice(0, 16);
}

export default function HospitalAppointmentsPage() {
  const toast = useToast();
  const [searchParams] = useSearchParams();
  const preselectedDonorId = searchParams.get('donorId') ?? '';
  const preselectedRequestId = searchParams.get('requestId') ?? '';
  const requestReference = searchParams.get('requestReference') ?? '';
  const initialDateFilter = searchParams.get('dateFilter') === 'today' ? 'today' : 'all';

  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [donors, setDonors] = useState<DonorMatch[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingDonors, setLoadingDonors] = useState(true);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today'>(initialDateFilter);
  const pageSize = 25;

  const [donorId, setDonorId] = useState(preselectedDonorId);
  const [scheduledAt, setScheduledAt] = useState(defaultScheduledAt());
  const [appointmentType, setAppointmentType] = useState<AppointmentType>(
    preselectedRequestId ? 'EMERGENCY_DONATION' : 'BLOOD_DONATION',
  );
  const [notes, setNotes] = useState(requestReference ? `Related request: ${requestReference}` : '');
  const [saving, setSaving] = useState(false);
  const [completionDrafts, setCompletionDrafts] = useState<Record<string, { unitsCollected: number; volumeCollectedMl: number; donationNotes: string }>>({});
  const [donationNumberPreviews, setDonationNumberPreviews] = useState<Record<string, string>>({});

  const load = async (nextPage = page) => {
    try {
      const data = await getHospitalAppointments({
        skip: nextPage * pageSize,
        take: pageSize,
        ...(dateFilter === 'today' ? getTodayAppointmentQuery() : {}),
      });
      setItems(data);
      setHasMore(data.length === pageSize);
      void loadDonationNumberPreviews(data);
    } finally {
      setLoading(false);
    }
  };

  const loadDonationNumberPreviews = async (appointments: AppointmentItem[]) => {
    const pendingDonationAppointments = appointments.filter(
      (item) => canCompleteAppointment(item),
    );
    const results = await Promise.allSettled(
      pendingDonationAppointments.map(async (item) => {
        const preview = await getAppointmentDonationNumberPreview(item.id);
        return [item.id, preview.donationNumber] as const;
      }),
    );
    const nextPreviews = Object.fromEntries(
      results
        .filter((result): result is PromiseFulfilledResult<readonly [string, string]> => result.status === 'fulfilled')
        .map((result) => result.value),
    );
    setDonationNumberPreviews((prev) => ({ ...prev, ...nextPreviews }));
  };

  const loadDonors = async () => {
    try {
      setLoadingDonors(true);
      const data = await getEligibleAppointmentDonors({ take: 100 });
      setDonors(data);
    } finally {
      setLoadingDonors(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page, dateFilter]);

  useEffect(() => {
    void loadDonors();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const selectedDonor = useMemo(() => donors.find((donor) => donor.id === donorId) ?? null, [donors, donorId]);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !searchTerm ||
          (item.donor?.fullName ?? '').toLowerCase().includes(searchTerm) ||
          item.appointmentReference.toLowerCase().includes(searchTerm) ||
          (item.donor?.donorNumber ?? '').toLowerCase().includes(searchTerm) ||
          (item.donationNumber ?? '').toLowerCase().includes(searchTerm) ||
          (item.donor?.bloodGroup ?? '').toLowerCase().includes(searchTerm) ||
          typeLabel(item.appointmentType).toLowerCase().includes(searchTerm) ||
          item.status.toLowerCase().includes(searchTerm),
      ),
    [items, searchTerm],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!donorId) {
      setMessage('Select an approved donor before scheduling.');
      return;
    }

    setSaving(true);
    setMessage('');
    try {
      const appointment = await createHospitalAppointment({
        donorId,
        scheduledAt: new Date(scheduledAt).toISOString(),
        appointmentType,
        bloodRequestId: preselectedRequestId || undefined,
        notes,
      });
      toast.success(`Appointment scheduled successfully. Reference: ${appointment.appointmentReference}.`);
      setDonorId('');
      setScheduledAt(defaultScheduledAt());
      setAppointmentType('BLOOD_DONATION');
      setNotes('');
      await load();
    } catch (error: any) {
      const text = error?.response?.data?.error?.message ?? 'Failed to schedule appointment.';
      setMessage(text);
      toast.error(text);
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    try {
      await updateHospitalAppointmentStatus(id, status);
      if (status === 'CANCELLED') {
        toast.success('Appointment cancelled successfully.');
      } else if (status === 'RESCHEDULED') {
        toast.success('Appointment rescheduled successfully.');
      } else {
        toast.success('Appointment status updated.');
      }
      await load();
    } catch (error: any) {
      const text = error?.response?.data?.error?.message ?? 'Failed to update appointment.';
      setMessage(text);
      toast.error(text);
    }
  };

  const completionDraft = (item: AppointmentItem) =>
    completionDrafts[item.id] ?? {
      unitsCollected: item.unitsCollected ?? 1,
      volumeCollectedMl: item.volumeCollectedMl ?? 450,
      donationNotes: item.donationNotes ?? '',
    };

  const setCompletionDraft = (id: string, patch: Partial<{ unitsCollected: number; volumeCollectedMl: number; donationNotes: string }>) => {
    setCompletionDrafts((prev) => ({
      ...prev,
      [id]: {
        unitsCollected: prev[id]?.unitsCollected ?? 1,
        volumeCollectedMl: prev[id]?.volumeCollectedMl ?? 450,
        donationNotes: prev[id]?.donationNotes ?? '',
        ...patch,
      },
    }));
  };

  const completeDonationWorkflow = async (item: AppointmentItem) => {
    if (!canCompleteAppointment(item)) {
      setMessage('This appointment cannot be completed or posted to inventory from its current status.');
      return;
    }
    const draft = completionDraft(item);
    if (Number(draft.unitsCollected) <= 0) {
      setMessage('Enter units collected before posting donation inventory.');
      return;
    }

    try {
      await completeHospitalAppointmentDonation(item.id, {
        unitsCollected: Number(draft.unitsCollected),
        volumeCollectedMl: Number(draft.volumeCollectedMl || 450),
        donationNotes: draft.donationNotes || undefined,
      });
      toast.success(item.donationPostedAt ? 'Donation already posted to inventory.' : `Donation posted to inventory for ${item.appointmentReference}.`);
      await load();
    } catch (error: any) {
      const text = error?.response?.data?.error?.message ?? 'Failed to complete donation workflow.';
      setMessage(text);
      toast.error(text);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Appointments</h1>
        <p className="text-sm text-muted">Schedule donor visits from approved donor records.</p>
      </div>

      <form className="card grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label className="text-sm font-semibold md:col-span-2">
          Select Donor
          <select className="legacy-input mt-1" required value={donorId} onChange={(e) => setDonorId(e.target.value)}>
            <option value="">{loadingDonors ? 'Loading approved donors...' : 'Select approved donor'}</option>
            {donors.map((donor) => (
              <option key={donor.id} value={donor.id}>
                {donor.fullName} ({donor.donorNumber ?? donor.id.slice(0, 8)}) -{' '}
                {bloodGroups.find((group) => group.value === donor.bloodGroup)?.label ?? donor.bloodGroup}
              </option>
            ))}
          </select>
        </label>

        {selectedDonor ? (
          <div className="rounded-lg border border-red-100 bg-red-50 p-3 text-sm md:col-span-2">
            <p className="font-semibold text-primary">{selectedDonor.fullName}</p>
            <div className="mt-2 grid gap-2 md:grid-cols-3">
              <p>Donor Ref: {selectedDonor.donorNumber ?? selectedDonor.id.slice(0, 8)}</p>
              <p>Blood: {bloodGroups.find((group) => group.value === selectedDonor.bloodGroup)?.label ?? selectedDonor.bloodGroup}</p>
              <p>Location: {selectedDonor.location}</p>
              <p>Availability: {selectedDonor.availabilityStatus ? 'Available' : 'Unavailable'}</p>
              <p>Eligibility: {selectedDonor.eligibilityStatus ? 'Eligible' : 'Not eligible'}</p>
              <p>
                Last Donation:{' '}
                {selectedDonor.donationHistory?.[0]?.donatedAt
                  ? new Date(selectedDonor.donationHistory[0].donatedAt).toLocaleDateString()
                  : 'No record'}
              </p>
            </div>
          </div>
        ) : null}

        <label className="text-sm font-semibold">
          Date & Time
          <input
            className="legacy-input mt-1"
            required
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
          />
        </label>
        <label className="text-sm font-semibold">
          Appointment Type
          <select className="legacy-input mt-1" value={appointmentType} onChange={(e) => setAppointmentType(e.target.value as AppointmentType)}>
            {appointmentTypes.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold md:col-span-2">
          Notes
          <input className="legacy-input mt-1" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn-primary md:col-span-2 md:w-fit" disabled={saving} type="submit">
          {saving ? 'Scheduling...' : 'Schedule Appointment'}
        </button>
      </form>

      {message ? <p className="text-sm text-primary">{message}</p> : null}

      <FilterBox
        label="Filter appointments (debounced)"
        placeholder="Filter by donor, donor reference, type, blood group, or status"
        value={searchInput}
        onChange={setSearchInput}
      />

      <div className="card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-bold text-primary">Appointment Date</p>
          <p className="text-xs text-muted">
            Today uses the appointment scheduled date in your local calendar day. Included statuses:{' '}
            {TODAY_APPOINTMENT_STATUSES_INCLUDED.join(', ')}.
          </p>
        </div>
        <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
          <button
            className={`rounded-lg px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
              dateFilter === 'all' ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => {
              setPage(0);
              setDateFilter('all');
            }}
            type="button"
          >
            All
          </button>
          <button
            className={`rounded-lg px-3 py-2 text-sm font-bold transition focus:outline-none focus:ring-4 focus:ring-red-100 ${
              dateFilter === 'today' ? 'bg-primary text-white' : 'text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => {
              setPage(0);
              setDateFilter('today');
            }}
            type="button"
          >
            Today
          </button>
        </div>
      </div>

      <div className="card overflow-x-auto">
        <h2 className="text-lg font-bold text-primary">Scheduled Appointments</h2>
        {loading ? <p className="mt-2 text-sm text-muted">Loading appointments...</p> : null}
        {!loading && filteredItems.length === 0 ? <p className="mt-2 text-sm text-muted">No appointments found for the selected filters. New bookings and donor responses will appear here.</p> : null}
        {!loading && filteredItems.length > 0 ? (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Appointment</th>
                <th className="py-2 pr-3">Donor</th>
                <th className="py-2 pr-3">Blood</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">
                    <p className="font-semibold">{item.appointmentReference}</p>
                    {item.bloodRequest?.requestReference ? <p className="text-xs text-muted">{item.bloodRequest.requestReference}</p> : null}
                  </td>
                  <td className="py-2 pr-3">
                    <p>{item.donor?.fullName ?? '-'}</p>
                    <p className="text-xs text-muted">{item.donor?.donorNumber ?? '-'}</p>
                  </td>
                  <td className="py-2 pr-3">
                    {item.donor?.bloodGroup
                      ? bloodGroups.find((group) => group.value === item.donor?.bloodGroup)?.label ?? item.donor?.bloodGroup
                      : '-'}
                  </td>
                  <td className="py-2 pr-3">{typeLabel(item.appointmentType)}</td>
                  <td className="py-2 pr-3">{new Date(item.scheduledAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">{item.status}</td>
                  <td className="py-2 pr-3">
                    <div className="space-y-2">
                      <select
                        className="legacy-input !w-40"
                        value={item.status}
                        onChange={(e) => void updateStatus(item.id, e.target.value as AppointmentStatus)}
                      >
                        {statusChoicesFor(item.status).map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                      {item.appointmentType === 'BLOOD_DONATION' ? (
                        item.donationPostedAt ? (
                          <div className="rounded-lg bg-green-50 p-2 text-xs font-semibold text-green-700">
                            <p>Donation posted to inventory</p>
                            <p>Donation No: {item.donationNumber ?? '-'}</p>
                            <p>Units: {item.unitsCollected ?? 1}</p>
                            <p>Blood: {item.donor?.bloodGroup ?? '-'}</p>
                          </div>
                        ) : item.status === 'CANCELLED' ? (
                          <div className="min-w-60 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                            <p className="font-bold text-slate-900">Cancellation Summary</p>
                            <p className="mt-2">Status: {item.status}</p>
                            <p>Cancelled By: {item.cancelledBy ?? 'Not recorded'}</p>
                            <p>Cancellation Date: {item.cancelledAt ? new Date(item.cancelledAt).toLocaleString() : 'Not recorded'}</p>
                            {item.cancellationReason ? <p>Cancellation Reason: {item.cancellationReason}</p> : null}
                            <p className="mt-2 font-bold text-slate-800">This appointment has been cancelled and cannot be completed.</p>
                          </div>
                        ) : item.status === 'COMPLETED' ? (
                          <div className="rounded-lg bg-green-50 p-2 text-xs font-semibold text-green-700">
                            <p>Appointment completed</p>
                            <p>Donation No: {item.donationNumber ?? 'Not posted'}</p>
                            <p>Units: {item.unitsCollected ?? '-'}</p>
                            <p>Blood: {item.donor?.bloodGroup ?? '-'}</p>
                          </div>
                        ) : canCompleteAppointment(item) ? (
                          <div className="min-w-60 rounded-lg border border-amber-200 bg-amber-50 p-2 text-xs">
                            <p className="font-bold text-amber-800">Complete with donation posting</p>
                            <label className="mt-2 block font-semibold">
                              Units Collected *
                              <input className="legacy-input mt-1 !py-1" min={1} type="number" value={completionDraft(item).unitsCollected} onChange={(event) => setCompletionDraft(item.id, { unitsCollected: Number(event.target.value) })} />
                            </label>
                            <label className="mt-2 block font-semibold">
                              Volume (ml)
                              <input className="legacy-input mt-1 !py-1" min={1} type="number" value={completionDraft(item).volumeCollectedMl} onChange={(event) => setCompletionDraft(item.id, { volumeCollectedMl: Number(event.target.value) })} />
                            </label>
                            <label className="mt-2 block font-semibold">
                              Donation Number
                              <input className="legacy-input mt-1 !py-1 bg-white/70" readOnly value={donationNumberPreviews[item.id] ?? 'Auto-generated on completion'} />
                              <span className="mt-1 block text-[11px] font-normal text-amber-700">
                                Auto-generated by the platform when the appointment is completed.
                              </span>
                            </label>
                            <label className="mt-2 block font-semibold">
                              Notes
                              <input className="legacy-input mt-1 !py-1" value={completionDraft(item).donationNotes} onChange={(event) => setCompletionDraft(item.id, { donationNotes: event.target.value })} />
                            </label>
                            <button className="mt-2 rounded-lg bg-red-700 px-3 py-2 font-bold text-white" type="button" onClick={() => void completeDonationWorkflow(item)}>
                              Complete Appointment
                            </button>
                          </div>
                        ) : null
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
        <Pager
          page={page}
          hasMore={hasMore}
          onPrev={() => setPage((value) => Math.max(0, value - 1))}
          onNext={() => setPage((value) => value + 1)}
        />
      </div>
    </section>
  );
}
