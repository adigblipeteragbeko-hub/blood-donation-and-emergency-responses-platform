import { FormEvent, useState } from 'react';

type Appointment = {
  id: number;
  center: string;
  date: string;
  status: 'Scheduled' | 'Cancelled';
};

export default function AppointmentsPage() {
  const [appointments, setAppointments] = useState<Appointment[]>([
    { id: 1, center: 'City Hospital', date: '2026-04-22', status: 'Scheduled' },
  ]);
  const [center, setCenter] = useState('City Hospital');
  const [date, setDate] = useState('2026-04-30');

  const book = (event: FormEvent) => {
    event.preventDefault();
    setAppointments((prev) => [{ id: Date.now(), center, date, status: 'Scheduled' }, ...prev]);
  };

  const reschedule = (id: number) => {
    setAppointments((prev) => prev.map((item) => (item.id === id ? { ...item, date: '2026-05-05' } : item)));
  };

  const cancel = (id: number) => {
    setAppointments((prev) => prev.map((item) => (item.id === id ? { ...item, status: 'Cancelled' } : item)));
  };

  return (
    <section className="space-y-3">
      <div className="card space-y-3">
        <h1 className="text-2xl font-bold text-primary">Appointments</h1>
        <p className="text-sm text-gray-600">Book, view, reschedule, or cancel donation appointments.</p>
        <form className="grid gap-2 sm:grid-cols-3" onSubmit={book}>
          <input className="legacy-input" value={center} onChange={(e) => setCenter(e.target.value)} placeholder="Center" required />
          <input className="legacy-input" type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
          <button className="btn-primary" type="submit">Book Appointment</button>
        </form>
      </div>

      <div className="card space-y-2">
        <h2 className="text-lg font-bold text-primary">Your Appointments</h2>
        {appointments.map((item) => (
          <article key={item.id} className="rounded border border-gray-200 p-3">
            <p className="font-semibold">{item.center}</p>
            <p className="text-sm text-gray-600">Date: {item.date}</p>
            <p className="text-sm text-gray-600">Status: {item.status}</p>
            <div className="mt-2 flex gap-2">
              <button className="rounded border border-primary px-3 py-1 text-sm font-semibold text-primary" onClick={() => reschedule(item.id)} type="button">
                Reschedule
              </button>
              <button className="rounded border border-red-300 px-3 py-1 text-sm font-semibold text-red-700" onClick={() => cancel(item.id)} type="button">
                Cancel
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
