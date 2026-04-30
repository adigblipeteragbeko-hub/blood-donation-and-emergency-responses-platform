import { useEffect, useMemo, useState } from 'react';
import {
  approveDonorEligibilityByHospital,
  EligibilitySubmissionItem,
  getEligibilitySubmissions,
  submitOfficeUseForm,
} from '../services/hospital-portal';

const officeUseInitial = {
  appearance: '',
  medicalHistory: '',
  weightKg: '',
  bloodPressure: '',
  pulseBpm: '',
  hbByCuSo4: '',
  hbCheckedGdl: '',
  hbSagChecked: '',
  hbSagResult: '',
  screeningOutcome: '',
  permanentDeferralReason: '',
  temporaryDeferralReason: '',
  temporaryDeferralDuration: '',
  comments: '',
  nurseName: '',
  nurseSignature: '',
  donationNumber: '',
  packType: '',
  bleedStart: '',
  bleedEnd: '',
  phlebotomyOutcome: '',
  unsuccessfulReason: '',
  adverseEvents: '',
};

export default function HospitalStaffManagementPage() {
  const [items, setItems] = useState<EligibilitySubmissionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeDonorId, setActiveDonorId] = useState('');
  const [officeUse, setOfficeUse] = useState(officeUseInitial);
  const [message, setMessage] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getEligibilitySubmissions();
      setItems(data);
      if (!activeDonorId && data.length > 0) {
        setActiveDonorId(data[0].donorId);
      }
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not load donor eligibility submissions.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const active = useMemo(() => items.find((item) => item.donorId === activeDonorId) ?? null, [items, activeDonorId]);

  useEffect(() => {
    if (!active) {
      setOfficeUse(officeUseInitial);
      return;
    }
    const existing = active.officeUse?.officeUseOnly as Record<string, unknown> | undefined;
    setOfficeUse({
      ...officeUseInitial,
      appearance: String(existing?.appearance ?? ''),
      medicalHistory: String(existing?.medicalHistory ?? ''),
      weightKg: String(existing?.weightKg ?? ''),
      bloodPressure: String(existing?.bloodPressure ?? ''),
      pulseBpm: String(existing?.pulseBpm ?? ''),
      hbByCuSo4: String(existing?.hbByCuSo4 ?? ''),
      hbCheckedGdl: String(existing?.hbCheckedGdl ?? ''),
      hbSagChecked: String(existing?.hbSagChecked ?? ''),
      hbSagResult: String(existing?.hbSagResult ?? ''),
      screeningOutcome: String(existing?.screeningOutcome ?? ''),
      permanentDeferralReason: String(existing?.permanentDeferralReason ?? ''),
      temporaryDeferralReason: String(existing?.temporaryDeferralReason ?? ''),
      temporaryDeferralDuration: String(existing?.temporaryDeferralDuration ?? ''),
      comments: String(existing?.comments ?? ''),
      nurseName: String(existing?.nurseName ?? ''),
      nurseSignature: String(existing?.nurseSignature ?? ''),
      donationNumber: String(existing?.donationNumber ?? ''),
      packType: String(existing?.packType ?? ''),
      bleedStart: String(existing?.bleedStart ?? ''),
      bleedEnd: String(existing?.bleedEnd ?? ''),
      phlebotomyOutcome: String(existing?.phlebotomyOutcome ?? ''),
      unsuccessfulReason: String(existing?.unsuccessfulReason ?? ''),
      adverseEvents: String(existing?.adverseEvents ?? ''),
    });
  }, [active]);

  const saveOfficeUse = async () => {
    if (!active) {
      return;
    }
    setMessage('');
    setError('');
    try {
      await submitOfficeUseForm(active.donorId, officeUse);
      setMessage('Office Use Only form saved.');
      await load();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not save office-use form.');
    }
  };

  const decision = async (approved: boolean) => {
    if (!active) {
      return;
    }
    setMessage('');
    setError('');
    try {
      await approveDonorEligibilityByHospital(active.donorId, approved);
      setMessage(approved ? 'Donor approved by hospital.' : 'Donor rejected by hospital.');
      await load();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not submit approval decision.');
    }
  };

  return (
    <section className="space-y-5">
      <div className="card">
        <h1 className="text-2xl font-bold text-primary">Donor Clinical Review (Hospital)</h1>
        <p className="text-sm text-muted">Review donor-submitted eligibility forms, complete Office Use Only, then approve/reject.</p>
      </div>
      {loading ? <p className="text-sm text-muted">Loading submissions...</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}
      {message ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">{message}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <aside className="card space-y-2">
          <h2 className="text-lg font-bold text-primary">Submitted Donors</h2>
          {items.length === 0 ? (
            <p className="text-sm text-muted">No donor submissions assigned to this hospital yet.</p>
          ) : (
            items.map((item) => (
              <button
                key={item.donorId}
                type="button"
                onClick={() => setActiveDonorId(item.donorId)}
                className={`w-full rounded border px-3 py-2 text-left text-sm ${
                  activeDonorId === item.donorId ? 'border-red-400 bg-red-50 text-primary' : 'border-gray-200'
                }`}
              >
                <p className="font-semibold">{item.donor?.fullName ?? 'Unknown Donor'}</p>
                <p>{item.donor?.bloodGroup ?? '-'}</p>
                <p className="text-xs text-gray-600">Submitted: {new Date(item.submittedAt).toLocaleString()}</p>
              </button>
            ))
          )}
        </aside>

        <div className="space-y-4">
          <section className="card">
            <h2 className="text-lg font-bold text-primary">Donor Form (Sections 1–4)</h2>
            {!active ? (
              <p className="text-sm text-muted">Select a donor submission.</p>
            ) : (
              <div className="space-y-2 text-sm">
                <p>
                  <span className="font-semibold">Donor:</span> {active.donor?.fullName ?? '-'} ({active.donor?.email ?? '-'})
                </p>
                <p>
                  <span className="font-semibold">Location:</span> {active.donor?.location ?? '-'}
                </p>
                <pre className="overflow-x-auto rounded bg-gray-50 p-3 text-xs">
                  {JSON.stringify(active.donorForm, null, 2)}
                </pre>
              </div>
            )}
          </section>

          <section className="card space-y-3">
            <h2 className="text-lg font-bold text-primary">Office Use Only (Sections 5–6)</h2>
            <div className="grid gap-3 md:grid-cols-2">
              <input className="legacy-input" placeholder="Appearance (Passed/Failed)" value={officeUse.appearance} onChange={(e) => setOfficeUse((v) => ({ ...v, appearance: e.target.value }))} />
              <input className="legacy-input" placeholder="Medical History (Passed/Failed)" value={officeUse.medicalHistory} onChange={(e) => setOfficeUse((v) => ({ ...v, medicalHistory: e.target.value }))} />
              <input className="legacy-input" placeholder="Weight (kg)" value={officeUse.weightKg} onChange={(e) => setOfficeUse((v) => ({ ...v, weightKg: e.target.value }))} />
              <input className="legacy-input" placeholder="Blood Pressure (mmHg)" value={officeUse.bloodPressure} onChange={(e) => setOfficeUse((v) => ({ ...v, bloodPressure: e.target.value }))} />
              <input className="legacy-input" placeholder="Pulse (bpm)" value={officeUse.pulseBpm} onChange={(e) => setOfficeUse((v) => ({ ...v, pulseBpm: e.target.value }))} />
              <input className="legacy-input" placeholder="Hb by CuSO4 (Passed/Failed)" value={officeUse.hbByCuSo4} onChange={(e) => setOfficeUse((v) => ({ ...v, hbByCuSo4: e.target.value }))} />
              <input className="legacy-input" placeholder="Hb checked (g/dL)" value={officeUse.hbCheckedGdl} onChange={(e) => setOfficeUse((v) => ({ ...v, hbCheckedGdl: e.target.value }))} />
              <input className="legacy-input" placeholder="HBsAg checked (Yes/No)" value={officeUse.hbSagChecked} onChange={(e) => setOfficeUse((v) => ({ ...v, hbSagChecked: e.target.value }))} />
              <input className="legacy-input" placeholder="HBsAg result" value={officeUse.hbSagResult} onChange={(e) => setOfficeUse((v) => ({ ...v, hbSagResult: e.target.value }))} />
              <input className="legacy-input" placeholder="Outcome of screening" value={officeUse.screeningOutcome} onChange={(e) => setOfficeUse((v) => ({ ...v, screeningOutcome: e.target.value }))} />
              <input className="legacy-input" placeholder="Permanent deferral reason" value={officeUse.permanentDeferralReason} onChange={(e) => setOfficeUse((v) => ({ ...v, permanentDeferralReason: e.target.value }))} />
              <input className="legacy-input" placeholder="Temporary deferral reason" value={officeUse.temporaryDeferralReason} onChange={(e) => setOfficeUse((v) => ({ ...v, temporaryDeferralReason: e.target.value }))} />
              <input className="legacy-input" placeholder="Temporary deferral duration" value={officeUse.temporaryDeferralDuration} onChange={(e) => setOfficeUse((v) => ({ ...v, temporaryDeferralDuration: e.target.value }))} />
              <input className="legacy-input" placeholder="Donation Number" value={officeUse.donationNumber} onChange={(e) => setOfficeUse((v) => ({ ...v, donationNumber: e.target.value }))} />
              <input className="legacy-input" placeholder="Pack Type" value={officeUse.packType} onChange={(e) => setOfficeUse((v) => ({ ...v, packType: e.target.value }))} />
              <input className="legacy-input" placeholder="Bleed Start" value={officeUse.bleedStart} onChange={(e) => setOfficeUse((v) => ({ ...v, bleedStart: e.target.value }))} />
              <input className="legacy-input" placeholder="Bleed End" value={officeUse.bleedEnd} onChange={(e) => setOfficeUse((v) => ({ ...v, bleedEnd: e.target.value }))} />
              <input className="legacy-input" placeholder="Phlebotomy Outcome" value={officeUse.phlebotomyOutcome} onChange={(e) => setOfficeUse((v) => ({ ...v, phlebotomyOutcome: e.target.value }))} />
              <input className="legacy-input" placeholder="Unsuccessful reason (if any)" value={officeUse.unsuccessfulReason} onChange={(e) => setOfficeUse((v) => ({ ...v, unsuccessfulReason: e.target.value }))} />
              <textarea className="legacy-input md:col-span-2" rows={2} placeholder="Donor adverse events" value={officeUse.adverseEvents} onChange={(e) => setOfficeUse((v) => ({ ...v, adverseEvents: e.target.value }))} />
              <textarea className="legacy-input md:col-span-2" rows={2} placeholder="Comments" value={officeUse.comments} onChange={(e) => setOfficeUse((v) => ({ ...v, comments: e.target.value }))} />
              <input className="legacy-input" placeholder="Name of Nurse" value={officeUse.nurseName} onChange={(e) => setOfficeUse((v) => ({ ...v, nurseName: e.target.value }))} />
              <input className="legacy-input" placeholder="Nurse Signature" value={officeUse.nurseSignature} onChange={(e) => setOfficeUse((v) => ({ ...v, nurseSignature: e.target.value }))} />
            </div>
            <div className="flex flex-wrap gap-2">
              <button className="btn-primary" type="button" onClick={() => void saveOfficeUse()} disabled={!active}>
                Save Office Use Form
              </button>
              <button
                className="rounded border border-green-300 px-4 py-2 font-semibold text-green-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => void decision(true)}
                disabled={!active}
              >
                Approve Donor
              </button>
              <button
                className="rounded border border-red-300 px-4 py-2 font-semibold text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                type="button"
                onClick={() => void decision(false)}
                disabled={!active}
              >
                Reject Donor
              </button>
            </div>
          </section>
        </div>
      </div>
    </section>
  );
}

