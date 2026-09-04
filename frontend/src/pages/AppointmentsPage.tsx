import { FormEvent, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
  acceptAppointment,
  cancelAppointment,
  declineAppointment,
  requestAppointmentReschedule,
  type AppointmentItem,
  type AppointmentStatus,
  type AppointmentType,
} from '../services/hospital-portal';
import { useToast } from '../components/ui/ToastProvider';

type HospitalOption = {
  id: string;
  hospitalName: string;
  location: string;
  registrationCode: string;
};

const declineReasons = ['Busy', 'Sick', 'Travelling', 'Personal Reason', 'Other'];

const typeLabels: Record<AppointmentType, string> = {
  BLOOD_DONATION: 'Blood Donation',
  ELIGIBILITY_SCREENING: 'Eligibility Screening',
  FOLLOW_UP: 'Follow-Up',
  EMERGENCY_DONATION: 'Emergency Donation',
};

const statusLabels: Record<AppointmentStatus, string> = {
  SCHEDULED: 'Scheduled',
  PENDING_CONFIRMATION: 'Pending Confirmation',
  CONFIRMED: 'Confirmed',
  DONOR_ARRIVED: 'Donor Arrived',
  IN_PROGRESS: 'In Progress',
  RESCHEDULE_REQUESTED: 'Reschedule Requested',
  RESCHEDULED: 'Rescheduled',
  DECLINED: 'Declined',
  COMPLETED: 'Completed',
  CANCELLED: 'Cancelled',
  MISSED: 'Missed',
  NO_SHOW: 'Missed',
};

const statusClasses: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-blue-50 text-blue-700 border-blue-100',
  PENDING_CONFIRMATION: 'bg-amber-50 text-amber-800 border-amber-100',
  CONFIRMED: 'bg-green-50 text-green-700 border-green-100',
  DONOR_ARRIVED: 'bg-cyan-50 text-cyan-700 border-cyan-100',
  IN_PROGRESS: 'bg-sky-50 text-sky-700 border-sky-100',
  RESCHEDULE_REQUESTED: 'bg-purple-50 text-purple-700 border-purple-100',
  RESCHEDULED: 'bg-indigo-50 text-indigo-700 border-indigo-100',
  DECLINED: 'bg-rose-50 text-rose-700 border-rose-100',
  COMPLETED: 'bg-teal-50 text-teal-700 border-teal-100',
  CANCELLED: 'bg-slate-100 text-slate-700 border-slate-200',
  MISSED: 'bg-orange-50 text-orange-700 border-orange-100',
  NO_SHOW: 'bg-orange-50 text-orange-700 border-orange-100',
};

const formatDate = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const formatTime = (value: string) =>
  new Date(value).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

const formatDateTime = (value?: string | null) => (value ? new Date(value).toLocaleString() : '-');

export default function AppointmentsPage() {
  const toast = useToast();
  const [appointments, setAppointments] = useState<AppointmentItem[]>([]);
  const [hospitalInput, setHospitalInput] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [hospitalOptions, setHospitalOptions] = useState<HospitalOption[]>([]);
  const [error, setError] = useState('');
  const [actingId, setActingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [rescheduleItem, setRescheduleItem] = useState<AppointmentItem | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [rescheduleTime, setRescheduleTime] = useState('');
  const [rescheduleReason, setRescheduleReason] = useState('');
  const [declineItem, setDeclineItem] = useState<AppointmentItem | null>(null);
  const [declineReason, setDeclineReason] = useState('Busy');
  const [declineNotes, setDeclineNotes] = useState('');

  const hospitalMap = useMemo(() => {
    const map = new Map<string, HospitalOption>();
    hospitalOptions.forEach((item) => map.set(item.hospitalName.toLowerCase(), item));
    return map;
  }, [hospitalOptions]);

  const selectedHospital = hospitalMap.get(hospitalInput.trim().toLowerCase()) ?? null;

  const loadData = async () => {
    setError('');
    try {
      const [appointmentsRes, hospitalsRes] = await Promise.all([
        api.get('/appointments'),
        api.get('/donors/hospital-options'),
      ]);
      setAppointments((appointmentsRes.data?.data ?? []) as AppointmentItem[]);
      setHospitalOptions((hospitalsRes.data?.data ?? []) as HospitalOption[]);
    } catch {
      setError('Could not load appointments or hospitals.');
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const runAction = async (id: string, action: () => Promise<AppointmentItem>, success: string) => {
    setError('');
    setActingId(id);
    try {
      await action();
      toast.success(success);
      await loadData();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      const text = extracted ?? 'Could not update appointment.';
      setError(text);
      toast.error(text);
    } finally {
      setActingId(null);
    }
  };

  const book = async (event: FormEvent) => {
    event.preventDefault();
    setError('');

    if (!selectedHospital) {
      setError('Hospital is not available. Please select a hospital from the list.');
      return;
    }

    try {
      const response = await api.post('/appointments', {
        hospitalId: selectedHospital.id,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      toast.success(`Appointment booked successfully. Reference: ${response.data?.data?.appointmentReference ?? 'Pending'}.`);
      setHospitalInput('');
      setScheduledAt('');
      await loadData();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      const text = extracted ?? 'Could not book appointment.';
      setError(text);
      toast.error(text);
    }
  };

  const onAccept = (item: AppointmentItem) => {
    if (!window.confirm(`Accept appointment ${item.appointmentReference}? The hospital will be notified immediately.`)) return;
    void runAction(item.id, () => acceptAppointment(item.id), 'Appointment accepted. The hospital has been notified.');
  };

  const onCancel = (item: AppointmentItem) => {
    if (!window.confirm(`Cancel appointment ${item.appointmentReference}? The hospital will be notified.`)) return;
    void runAction(item.id, () => cancelAppointment(item.id), 'Appointment cancelled. The hospital has been notified.');
  };

  const openReschedule = (item: AppointmentItem) => {
    const current = new Date(item.scheduledAt);
    setRescheduleItem(item);
    setRescheduleDate(current.toISOString().slice(0, 10));
    setRescheduleTime(current.toTimeString().slice(0, 5));
    setRescheduleReason('');
  };

  const submitReschedule = async (event: FormEvent) => {
    event.preventDefault();
    if (!rescheduleItem) return;
    const preferredAt = new Date(`${rescheduleDate}T${rescheduleTime}`);
    if (Number.isNaN(preferredAt.getTime())) {
      setError('Please select a valid preferred date and time.');
      return;
    }
    await runAction(
      rescheduleItem.id,
      () => requestAppointmentReschedule(rescheduleItem.id, {
        preferredAt: preferredAt.toISOString(),
        reason: rescheduleReason || undefined,
      }),
      'Reschedule request sent. The hospital has been notified.',
    );
    setRescheduleItem(null);
  };

  const openDecline = (item: AppointmentItem) => {
    setDeclineItem(item);
    setDeclineReason('Busy');
    setDeclineNotes('');
  };

  const submitDecline = async (event: FormEvent) => {
    event.preventDefault();
    if (!declineItem) return;
    if (!window.confirm(`Decline appointment ${declineItem.appointmentReference}? The hospital will be notified.`)) return;
    await runAction(
      declineItem.id,
      () => declineAppointment(declineItem.id, { reason: declineReason, notes: declineNotes || undefined }),
      'Appointment declined. The hospital has been notified.',
    );
    setDeclineItem(null);
  };

  return (
    <section className="space-y-3">
      <div className="card space-y-3">
        <h1 className="text-2xl font-bold text-primary">Appointments</h1>
        <p className="text-sm text-gray-600">Book, view, reschedule, or cancel donation appointments.</p>
        {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
        <form className="grid gap-2 sm:grid-cols-3" onSubmit={book} autoComplete="off">
          <div className="space-y-1">
            <input
              className="legacy-input"
              value={hospitalInput}
              onChange={(e) => setHospitalInput(e.target.value)}
              placeholder="Hospital"
              list="hospital-options-list"
              required
            />
            <datalist id="hospital-options-list">
              {hospitalOptions.map((hospital) => (
                <option key={hospital.id} value={hospital.hospitalName}>
                  {hospital.location}
                </option>
              ))}
            </datalist>
            {!selectedHospital && hospitalInput.trim() ? (
              <p className="text-xs text-red-700">Hospital is not available or cannot be booked.</p>
            ) : null}
          </div>
          <input
            className="legacy-input"
            type="datetime-local"
            value={scheduledAt}
            onChange={(e) => setScheduledAt(e.target.value)}
            required
          />
          <button className="btn-primary" type="submit">Book Appointment</button>
        </form>
      </div>

      <div className="card space-y-3">
        <h2 className="text-lg font-bold text-primary">Your Appointments</h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-gray-600">No appointments found. New hospital appointments and your booking history will appear here.</p>
        ) : (
          appointments.map((item) => {
            const pending = item.status === 'PENDING_CONFIRMATION';
            const canCancel = ['SCHEDULED', 'CONFIRMED', 'RESCHEDULED'].includes(item.status);
            const isExpanded = expanded[item.id];
            return (
              <article key={item.id} className="rounded-2xl border border-gray-200 p-4">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-lg font-black text-slate-900">{item.hospital?.hospitalName ?? 'Hospital'}</p>
                    <p className="text-sm font-semibold text-gray-600">Reference: {item.appointmentReference}</p>
                  </div>
                  <span className={`w-fit rounded-full border px-3 py-1 text-xs font-black ${statusClasses[item.status] ?? statusClasses.SCHEDULED}`}>
                    {statusLabels[item.status] ?? item.status}
                  </span>
                </div>

                <div className="mt-3 grid gap-2 text-sm text-gray-700 sm:grid-cols-2 lg:grid-cols-3">
                  <p><span className="font-bold">Donation Type:</span> {typeLabels[item.appointmentType ?? 'BLOOD_DONATION']}</p>
                  <p><span className="font-bold">Date:</span> {formatDate(item.scheduledAt)}</p>
                  <p><span className="font-bold">Time:</span> {formatTime(item.scheduledAt)}</p>
                  <p><span className="font-bold">Hospital Location:</span> {item.hospital?.location ?? '-'}</p>
                  {item.notes ? <p><span className="font-bold">Notes:</span> {item.notes}</p> : null}
                  {item.reschedulePreferredAt ? <p><span className="font-bold">Preferred New Time:</span> {formatDateTime(item.reschedulePreferredAt)}</p> : null}
                </div>

                {isExpanded ? (
                  <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">
                    <p><span className="font-bold">Current appointment:</span> {formatDateTime(item.scheduledAt)}</p>
                    {item.confirmedAt ? <p><span className="font-bold">Confirmed:</span> {formatDateTime(item.confirmedAt)}</p> : null}
                    {item.rescheduleReason ? <p><span className="font-bold">Reschedule Reason:</span> {item.rescheduleReason}</p> : null}
                    {item.declineReason ? <p><span className="font-bold">Decline Reason:</span> {item.declineReason}</p> : null}
                    {item.declineNotes ? <p><span className="font-bold">Decline Notes:</span> {item.declineNotes}</p> : null}
                    {item.cancellationReason ? <p><span className="font-bold">Cancellation:</span> {item.cancellationReason}</p> : null}
                  </div>
                ) : null}

                <div className="mt-4 flex flex-wrap gap-2">
                  {pending ? (
                    <>
                      <button className="btn-primary" disabled={actingId === item.id} onClick={() => onAccept(item)} type="button">
                        Accept Appointment
                      </button>
                      <button className="rounded-xl border border-amber-200 px-4 py-2 text-sm font-bold text-amber-800" disabled={actingId === item.id} onClick={() => openReschedule(item)} type="button">
                        Request Reschedule
                      </button>
                      <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-primary" disabled={actingId === item.id} onClick={() => openDecline(item)} type="button">
                        Decline Appointment
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
                        onClick={() => setExpanded((current) => ({ ...current, [item.id]: !current[item.id] }))}
                        type="button"
                      >
                        View Details
                      </button>
                      {canCancel ? (
                        <button className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-primary" disabled={actingId === item.id} onClick={() => onCancel(item)} type="button">
                          Cancel Appointment
                        </button>
                      ) : null}
                    </>
                  )}
                </div>
              </article>
            );
          })
        )}
      </div>

      {rescheduleItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onSubmit={submitReschedule}>
            <h3 className="text-xl font-black text-slate-950">Request Reschedule</h3>
            <p className="mt-2 text-sm text-slate-600">Current appointment: {formatDateTime(rescheduleItem.scheduledAt)}</p>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Preferred New Date
              <input className="legacy-input mt-1" type="date" value={rescheduleDate} onChange={(e) => setRescheduleDate(e.target.value)} required />
            </label>
            <label className="mt-3 block text-sm font-bold text-slate-700">
              Preferred New Time
              <input className="legacy-input mt-1" type="time" value={rescheduleTime} onChange={(e) => setRescheduleTime(e.target.value)} required />
            </label>
            <label className="mt-3 block text-sm font-bold text-slate-700">
              Reason
              <textarea className="legacy-input mt-1 min-h-24" value={rescheduleReason} onChange={(e) => setRescheduleReason(e.target.value)} placeholder="Optional" />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700" onClick={() => setRescheduleItem(null)} type="button">
                Close
              </button>
              <button className="btn-primary" disabled={actingId === rescheduleItem.id} type="submit">
                Submit Request
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {declineItem ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <form className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl" onSubmit={submitDecline}>
            <h3 className="text-xl font-black text-slate-950">Decline Appointment</h3>
            <p className="mt-2 text-sm text-slate-600">Appointment: {declineItem.appointmentReference}</p>
            <label className="mt-4 block text-sm font-bold text-slate-700">
              Reason
              <select className="legacy-input mt-1" value={declineReason} onChange={(e) => setDeclineReason(e.target.value)} required>
                {declineReasons.map((reason) => <option key={reason} value={reason}>{reason}</option>)}
              </select>
            </label>
            <label className="mt-3 block text-sm font-bold text-slate-700">
              Notes
              <textarea className="legacy-input mt-1 min-h-24" value={declineNotes} onChange={(e) => setDeclineNotes(e.target.value)} placeholder="Optional" />
            </label>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700" onClick={() => setDeclineItem(null)} type="button">
                Close
              </button>
              <button className="btn-primary" disabled={actingId === declineItem.id} type="submit">
                Decline Appointment
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
