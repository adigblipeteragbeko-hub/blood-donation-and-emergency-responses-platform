import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  AppointmentItem,
  AppointmentStatus,
  createHospitalAppointment,
  getHospitalAppointments,
  updateHospitalAppointmentStatus,
} from '../services/hospital-portal';
import { bloodGroups } from '../constants/blood-groups';
import { FilterBox, Pager } from '../components/TableControls';

const statusOptions: AppointmentStatus[] = ['SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'];

export default function HospitalAppointmentsPage() {
  const [items, setItems] = useState<AppointmentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [searchInput, setSearchInput] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const pageSize = 25;

  const [donorId, setDonorId] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);

  const load = async (nextPage = page) => {
    try {
      const data = await getHospitalAppointments({ skip: nextPage * pageSize, take: pageSize });
      setItems(data);
      setHasMore(data.length === pageSize);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, [page]);

  useEffect(() => {
    const timer = setTimeout(() => setSearchTerm(searchInput.trim().toLowerCase()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  const filteredItems = useMemo(
    () =>
      items.filter(
        (item) =>
          !searchTerm ||
          (item.donor?.fullName ?? '').toLowerCase().includes(searchTerm) ||
          (item.donor?.bloodGroup ?? '').toLowerCase().includes(searchTerm) ||
          item.status.toLowerCase().includes(searchTerm),
      ),
    [items, searchTerm],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setMessage('');
    try {
      await createHospitalAppointment({ donorId, scheduledAt: new Date(scheduledAt).toISOString(), notes });
      setMessage('Appointment scheduled.');
      setDonorId('');
      setScheduledAt('');
      setNotes('');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to schedule appointment.');
    } finally {
      setSaving(false);
    }
  };

  const updateStatus = async (id: string, status: AppointmentStatus) => {
    try {
      await updateHospitalAppointmentStatus(id, status);
      setMessage('Appointment status updated.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to update appointment.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Appointments</h1>
        <p className="text-sm text-muted">Schedule, confirm, and cancel donor appointments.</p>
      </div>
      <FilterBox
        label="Filter appointments (debounced)"
        placeholder="Filter by donor name, blood group, or status"
        value={searchInput}
        onChange={setSearchInput}
      />

      <form className="card grid gap-3 md:grid-cols-3" onSubmit={submit}>
        <label className="text-sm font-semibold">
          Donor ID
          <input className="legacy-input mt-1" required type="text" value={donorId} onChange={(e) => setDonorId(e.target.value)} />
        </label>
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
          Notes
          <input className="legacy-input mt-1" type="text" value={notes} onChange={(e) => setNotes(e.target.value)} />
        </label>
        <button className="btn-primary md:col-span-3 md:w-fit" disabled={saving} type="submit">
          {saving ? 'Scheduling...' : 'Schedule Appointment'}
        </button>
      </form>

      {message ? <p className="text-sm text-primary">{message}</p> : null}

      <div className="card overflow-x-auto">
        <h2 className="text-lg font-bold text-primary">Scheduled Appointments</h2>
        {loading ? <p className="mt-2 text-sm text-muted">Loading appointments...</p> : null}
        {!loading && filteredItems.length === 0 ? <p className="mt-2 text-sm text-muted">No appointments found.</p> : null}
        {!loading && filteredItems.length > 0 ? (
          <table className="mt-3 min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Donor</th>
                <th className="py-2 pr-3">Blood</th>
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">{item.donor?.fullName ?? '-'}</td>
                  <td className="py-2 pr-3">
                    {item.donor?.bloodGroup
                      ? bloodGroups.find((group) => group.value === item.donor?.bloodGroup)?.label ?? item.donor?.bloodGroup
                      : '-'}
                  </td>
                  <td className="py-2 pr-3">{new Date(item.scheduledAt).toLocaleString()}</td>
                  <td className="py-2 pr-3">{item.status}</td>
                  <td className="py-2 pr-3">
                    <select
                      className="legacy-input !w-40"
                      value={item.status}
                      onChange={(e) => void updateStatus(item.id, e.target.value as AppointmentStatus)}
                    >
                      {statusOptions.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
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
