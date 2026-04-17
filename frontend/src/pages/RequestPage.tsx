import { FormEvent, useState } from 'react';

type RequestItem = {
  fullName: string;
  location: string;
  city: string;
  bloodGroup: string;
  gender: string;
  contact: string;
};

export default function RequestPage() {
  const [requests, setRequests] = useState<RequestItem[]>([]);
  const [form, setForm] = useState<RequestItem>({
    fullName: '',
    location: '',
    city: '',
    bloodGroup: 'A+',
    gender: 'Male',
    contact: '',
  });

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setRequests((prev) => [form, ...prev]);
    setForm({ fullName: '', location: '', city: '', bloodGroup: 'A+', gender: 'Male', contact: '' });
  };

  return (
    <section className="space-y-6">
      <form className="legacy-panel mx-auto max-w-5xl space-y-4" onSubmit={submit}>
        <h1 className="text-4xl font-bold text-primary">Blood Request</h1>
        <div className="grid gap-3 md:grid-cols-2">
          <label className="text-sm font-semibold">
            Full Name
            <input className="legacy-input mt-1" value={form.fullName} onChange={(e) => setForm((v) => ({ ...v, fullName: e.target.value }))} required />
          </label>
          <label className="text-sm font-semibold">
            City
            <input className="legacy-input mt-1" value={form.city} onChange={(e) => setForm((v) => ({ ...v, city: e.target.value }))} required />
          </label>
          <label className="text-sm font-semibold">
            Location
            <input className="legacy-input mt-1" value={form.location} onChange={(e) => setForm((v) => ({ ...v, location: e.target.value }))} required />
          </label>
          <label className="text-sm font-semibold">
            Contact
            <input className="legacy-input mt-1" value={form.contact} onChange={(e) => setForm((v) => ({ ...v, contact: e.target.value }))} required />
          </label>
          <label className="text-sm font-semibold">
            Blood Group
            <select className="legacy-input mt-1" value={form.bloodGroup} onChange={(e) => setForm((v) => ({ ...v, bloodGroup: e.target.value }))}>
              {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Gender
            <select className="legacy-input mt-1" value={form.gender} onChange={(e) => setForm((v) => ({ ...v, gender: e.target.value }))}>
              {['Male', 'Female', 'Other'].map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </label>
        </div>
        <button className="btn-primary w-full" type="submit">Send Request</button>
      </form>

      <div className="legacy-panel mx-auto max-w-5xl space-y-3">
        <h2 className="text-4xl font-bold text-primary">Blood Requests</h2>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-red-300 text-primary">
                <th className="py-2">Name</th>
                <th className="py-2">Location</th>
                <th className="py-2">City</th>
                <th className="py-2">Blood Group</th>
                <th className="py-2">Gender</th>
                <th className="py-2">Contact</th>
              </tr>
            </thead>
            <tbody>
              {requests.length === 0 ? (
                <tr>
                  <td className="py-3 text-gray-600" colSpan={6}>No requests yet. Submit one above.</td>
                </tr>
              ) : (
                requests.map((item, index) => (
                  <tr key={`${item.fullName}-${index}`} className="border-b border-red-100">
                    <td className="py-2">{item.fullName}</td>
                    <td className="py-2">{item.location}</td>
                    <td className="py-2">{item.city}</td>
                    <td className="py-2">{item.bloodGroup}</td>
                    <td className="py-2">{item.gender}</td>
                    <td className="py-2">{item.contact}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
