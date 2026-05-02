import { FormEvent, useEffect, useMemo, useState } from 'react';
import api from '../services/api';

type HospitalOption = {
  id: string;
  hospitalName: string;
  location: string;
  registrationCode: string;
};

type Appointment = {
  id: string;
  scheduledAt: string;
  status: string;
  hospital?: { id: string; hospitalName: string; location: string };
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [hospitalInput, setHospitalInput] = useState('');
  const [scheduledAt, setScheduledAt] = useState('');
  const [hospitalOptions, setHospitalOptions] = useState<HospitalOption[]>([]);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

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
      setAppointments((appointmentsRes.data?.data ?? []) as Appointment[]);
      setHospitalOptions((hospitalsRes.data?.data ?? []) as HospitalOption[]);
    } catch {
      setError('Could not load appointments or hospitals.');
    }
  };

  useEffect(() => {
    void loadData();
  }, []);

  const book = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    setMessage('');

    if (!selectedHospital) {
      setError('Hospital is not available. Please select a hospital from the list.');
      return;
    }

    try {
      await api.post('/appointments', {
        hospitalId: selectedHospital.id,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      setMessage('Appointment booked successfully.');
      setHospitalInput('');
      setScheduledAt('');
      await loadData();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not book appointment.');
    }
  };

  return (
    <section className="space-y-3">
      <div className="card space-y-3">
        <h1 className="text-2xl font-bold text-primary">Appointments</h1>
        <p className="text-sm text-gray-600">Book, view, reschedule, or cancel donation appointments.</p>
        {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
        {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}
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

      <div className="card space-y-2">
        <h2 className="text-lg font-bold text-primary">Your Appointments</h2>
        {appointments.length === 0 ? (
          <p className="text-sm text-gray-600">No appointments yet.</p>
        ) : (
          appointments.map((item) => (
            <article key={item.id} className="rounded border border-gray-200 p-3">
              <p className="font-semibold">{item.hospital?.hospitalName ?? 'Hospital'}</p>
              <p className="text-sm text-gray-600">Location: {item.hospital?.location ?? '-'}</p>
              <p className="text-sm text-gray-600">Date: {new Date(item.scheduledAt).toLocaleString()}</p>
              <p className="text-sm text-gray-600">Status: {item.status}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
