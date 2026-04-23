import { useEffect, useState } from 'react';
import {
  BloodRequestItem,
  DonorResponseStatus,
  RequestProgressStatus,
  RequestStatus,
  createBloodRequestUpdate,
  getHospitalRequests,
  updateDonorResponse,
  updateHospitalRequestStatus,
} from '../services/hospital-portal';
import { bloodGroups } from '../constants/blood-groups';

const statusOptions: RequestStatus[] = ['OPEN', 'MATCHING', 'FULFILLED', 'CANCELLED'];
const trackingOptions: RequestProgressStatus[] = ['PENDING', 'MATCHED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const donorResponseOptions: DonorResponseStatus[] = ['PENDING', 'ACCEPTED', 'DECLINED', 'DONATED'];

export default function HospitalActiveRequestsPage() {
  const [items, setItems] = useState<BloodRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [trackingDrafts, setTrackingDrafts] = useState<Record<string, { newStatus: RequestProgressStatus; comment: string }>>({});
  const [responseDrafts, setResponseDrafts] = useState<Record<string, DonorResponseStatus>>({});

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

  const ensureTrackingDraft = (item: BloodRequestItem) => {
    if (trackingDrafts[item.id]) {
      return trackingDrafts[item.id];
    }
    return {
      newStatus: item.trackingStatus,
      comment: '',
    };
  };

  const ensureResponseDraft = (responseId: string, currentStatus: DonorResponseStatus) =>
    responseDrafts[responseId] ?? currentStatus;

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Active Requests</h1>
        <p className="text-sm text-muted">Track ongoing requests, donor responses, and fulfillment progress.</p>
      </div>

      <div className="card">
        {loading ? <p className="text-sm text-muted">Loading requests...</p> : null}
        {!loading && items.length === 0 ? <p className="text-sm text-muted">No requests found yet.</p> : null}
        {!loading && items.length > 0 ? (
          <div className="space-y-4">
            {items.map((item) => {
              const trackingDraft = ensureTrackingDraft(item);
              return (
                <article key={item.id} className="rounded-xl border border-red-100 p-4">
                  <div className="grid gap-2 md:grid-cols-3">
                    <p className="text-sm">
                      <span className="font-semibold">Blood:</span>{' '}
                      {bloodGroups.find((group) => group.value === item.bloodGroup)?.label ?? item.bloodGroup}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Units:</span> {item.unitsNeeded}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Required:</span> {new Date(item.requiredBy).toLocaleString()}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Priority:</span> {item.priority}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Workflow:</span> {item.status}
                    </p>
                    <p className="text-sm">
                      <span className="font-semibold">Tracking:</span> {item.trackingStatus}
                    </p>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <label className="text-sm font-semibold">
                      Update Request Status
                      <select
                        className="legacy-input mt-1"
                        value={item.status}
                        onChange={(e) => void changeStatus(item.id, e.target.value as RequestStatus)}
                      >
                        {statusOptions.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-semibold">Add Tracking Update</p>
                      <div className="mt-2 grid gap-2 md:grid-cols-[1fr_2fr_auto]">
                        <select
                          className="legacy-input"
                          value={trackingDraft.newStatus}
                          onChange={(e) =>
                            setTrackingDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...trackingDraft, newStatus: e.target.value as RequestProgressStatus },
                            }))
                          }
                        >
                          {trackingOptions.map((option) => (
                            <option key={option} value={option}>
                              {option}
                            </option>
                          ))}
                        </select>
                        <input
                          className="legacy-input"
                          placeholder="Optional comment"
                          value={trackingDraft.comment}
                          onChange={(e) =>
                            setTrackingDrafts((prev) => ({
                              ...prev,
                              [item.id]: { ...trackingDraft, comment: e.target.value },
                            }))
                          }
                        />
                        <button
                          className="btn-primary"
                          type="button"
                          onClick={async () => {
                            setMessage('');
                            try {
                              await createBloodRequestUpdate(item.id, {
                                newStatus: trackingDraft.newStatus,
                                comment: trackingDraft.comment || undefined,
                              });
                              setMessage('Tracking update added.');
                              await load();
                            } catch (error: any) {
                              setMessage(error?.response?.data?.error?.message ?? 'Failed to add tracking update.');
                            }
                          }}
                        >
                          Add
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-semibold">Latest Tracking Timeline</p>
                      {item.updates?.length ? (
                        <div className="mt-2 space-y-2 text-xs">
                          {item.updates.map((update) => (
                            <div key={update.id} className="rounded border border-gray-100 p-2">
                              <p>
                                {update.oldStatus ?? 'NONE'} to {update.newStatus}
                              </p>
                              <p>{update.comment || 'No comment'}</p>
                              <p className="text-gray-500">{new Date(update.createdAt).toLocaleString()}</p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-gray-600">No tracking updates yet.</p>
                      )}
                    </div>

                    <div className="rounded-lg border border-gray-200 p-3">
                      <p className="text-sm font-semibold">Donor Responses</p>
                      {item.donorResponses?.length ? (
                        <div className="mt-2 space-y-2">
                          {item.donorResponses.map((response) => (
                            <div key={response.id} className="rounded border border-gray-100 p-2">
                              <p className="text-xs font-semibold">{response.donor.fullName}</p>
                              <p className="text-xs text-gray-600">{response.donor.user.email}</p>
                              <div className="mt-2 flex gap-2">
                                <select
                                  className="legacy-input !w-40"
                                  value={ensureResponseDraft(response.id, response.responseStatus)}
                                  onChange={(e) =>
                                    setResponseDrafts((prev) => ({
                                      ...prev,
                                      [response.id]: e.target.value as DonorResponseStatus,
                                    }))
                                  }
                                >
                                  {donorResponseOptions.map((option) => (
                                    <option key={option} value={option}>
                                      {option}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700"
                                  type="button"
                                  onClick={async () => {
                                    setMessage('');
                                    try {
                                      await updateDonorResponse(response.id, {
                                        responseStatus: ensureResponseDraft(response.id, response.responseStatus),
                                      });
                                      setMessage('Donor response updated.');
                                      await load();
                                    } catch (error: any) {
                                      setMessage(error?.response?.data?.error?.message ?? 'Failed to update donor response.');
                                    }
                                  }}
                                >
                                  Save
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-gray-600">No donor responses yet.</p>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
      {message ? <p className="text-sm text-primary">{message}</p> : null}
    </section>
  );
}
