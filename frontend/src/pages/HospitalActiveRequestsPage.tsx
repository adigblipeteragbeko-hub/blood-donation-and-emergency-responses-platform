import { useEffect, useState } from 'react';
import {
  BloodRequestItem,
  RequestStatus,
  getHospitalRequests,
  updateHospitalRequestStatus,
} from '../services/hospital-portal';
import { bloodGroups } from '../constants/blood-groups';

const statusOptions: RequestStatus[] = ['OPEN', 'MATCHING', 'FULFILLED', 'CANCELLED'];

export default function HospitalActiveRequestsPage() {
  const [items, setItems] = useState<BloodRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const data = await getHospitalRequests();
      setItems(data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const changeStatus = async (id: string, status: RequestStatus) => {
    setMessage('');
    try {
      await updateHospitalRequestStatus(id, status);
      setMessage('Request status updated.');
      await load();
    } catch (error: any) {
      setMessage(error?.response?.data?.error?.message ?? 'Failed to update request status.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Active Requests</h1>
        <p className="text-sm text-muted">Track ongoing requests, donor responses, and fulfillment progress.</p>
      </div>

      <div className="card overflow-x-auto">
        {loading ? <p className="text-sm text-muted">Loading requests...</p> : null}
        {!loading && items.length === 0 ? <p className="text-sm text-muted">No requests found yet.</p> : null}
        {!loading && items.length > 0 ? (
          <table className="min-w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-3">Blood</th>
                <th className="py-2 pr-3">Units</th>
                <th className="py-2 pr-3">Type</th>
                <th className="py-2 pr-3">Priority</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Required By</th>
                <th className="py-2 pr-3">Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b last:border-b-0">
                  <td className="py-2 pr-3">
                    {bloodGroups.find((group) => group.value === item.bloodGroup)?.label ?? item.bloodGroup}
                  </td>
                  <td className="py-2 pr-3">{item.unitsNeeded}</td>
                  <td className="py-2 pr-3">{item.type}</td>
                  <td className="py-2 pr-3">{item.priority}</td>
                  <td className="py-2 pr-3">{item.status}</td>
                  <td className="py-2 pr-3">{new Date(item.requiredBy).toLocaleString()}</td>
                  <td className="py-2 pr-3">
                    <select
                      className="legacy-input !w-40"
                      value={item.status}
                      onChange={(e) => void changeStatus(item.id, e.target.value as RequestStatus)}
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
      </div>
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </section>
  );
}

