import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ClinicalStatus,
  DonorClinicalRecord,
  downloadClinicalRecordExport,
  getClinicalReviewQueue,
  updateClinicalReview,
  updateDonationOutcome,
  updateOfficeUse,
} from '../services/donor-clinical-records';

const statuses: Array<ClinicalStatus | ''> = [
  '',
  'SUBMITTED',
  'HOSPITAL_REVIEW',
  'OFFICE_USE_COMPLETED',
  'APPROVED',
  'REJECTED',
  'TEMPORARILY_DEFERRED',
  'PERMANENTLY_DEFERRED',
];

const statusLabels: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'New submission',
  HOSPITAL_REVIEW: 'Hospital review',
  OFFICE_USE_COMPLETED: 'Office use completed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  TEMPORARILY_DEFERRED: 'Temporarily deferred',
  PERMANENTLY_DEFERRED: 'Permanently deferred',
};

const badgeClass: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700',
  SUBMITTED: 'bg-blue-50 text-blue-700',
  HOSPITAL_REVIEW: 'bg-amber-50 text-amber-800',
  OFFICE_USE_COMPLETED: 'bg-indigo-50 text-indigo-700',
  APPROVED: 'bg-green-50 text-green-700',
  REJECTED: 'bg-red-50 text-red-700',
  TEMPORARILY_DEFERRED: 'bg-orange-50 text-orange-700',
  PERMANENTLY_DEFERRED: 'bg-red-100 text-red-800',
};

const passFail = ['', 'PASSED', 'FAILED'];
const yesNo = ['', 'YES', 'NO'];
const screeningOutcomes = ['', 'QUALIFIED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED', 'REJECTED'];
const packTypes = ['', 'SINGLE', 'DOUBLE', 'TRIPLE', 'QUAD'];
const phlebotomyOutcomes = ['', 'SUCCESSFUL', 'UNSUCCESSFUL'];

export default function DonorClinicalReviewQueuePage() {
  const [items, setItems] = useState<DonorClinicalRecord[]>([]);
  const [selected, setSelected] = useState<DonorClinicalRecord | null>(null);
  const [status, setStatus] = useState('');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [reviewNotes, setReviewNotes] = useState('');
  const [office, setOffice] = useState<Record<string, any>>({ outcomeOfScreening: 'QUALIFIED', qualifiesToDonate: 'YES' });
  const [donation, setDonation] = useState<Record<string, any>>({ packType: 'SINGLE', outcomeOfPhlebotomy: 'SUCCESSFUL' });

  const loadQueue = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getClinicalReviewQueue({ status: status || undefined, search: search || undefined });
      setItems(data.items ?? []);
      if (selected) {
        const refreshed = data.items.find((item) => item.id === selected.id);
        if (refreshed) setSelected(refreshed);
      }
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Could not load donor clinical review queue.');
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, [status]);

  const selectedName = useMemo(() => {
    if (!selected) return '';
    return `${selected.firstName ?? selected.donor?.fullName ?? ''} ${selected.lastName ?? ''}`.trim() || 'Unnamed donor';
  }, [selected]);

  const pickRecord = (record: DonorClinicalRecord) => {
    setSelected(record);
    setReviewNotes(record.reviewNotes ?? '');
    setOffice({ outcomeOfScreening: record.clinicalReview?.outcomeOfScreening ?? 'QUALIFIED', qualifiesToDonate: record.clinicalReview?.qualifiesToDonate ?? 'YES', ...record.clinicalReview });
    setDonation({ packType: record.donationOutcome?.packType ?? 'SINGLE', outcomeOfPhlebotomy: record.donationOutcome?.outcomeOfPhlebotomy ?? 'SUCCESSFUL', ...record.donationOutcome });
    setMessage('');
    setError('');
  };

  const runAction = async (action: () => Promise<DonorClinicalRecord>, success: string) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const updated = await action();
      setSelected(updated);
      setMessage(success);
      await loadQueue();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Action failed.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="space-y-5">
      <div className="card border-red-100 bg-red-50/40">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Office use only</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">Donor Clinical Review Queue</h1>
        <p className="text-sm text-gray-600">Review submitted donor clinical records, complete office-use screening, and record donation outcomes.</p>
      </div>

      {message ? <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="card grid gap-3 md:grid-cols-[220px_1fr_auto]">
        <select className="legacy-input" value={status} onChange={(event) => setStatus(event.target.value)}>
          {statuses.map((item) => <option key={item || 'ALL'} value={item}>{item ? statusLabels[item] : 'All records'}</option>)}
        </select>
        <input className="legacy-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search donor name or email" />
        <button type="button" className="btn-primary" onClick={() => loadQueue()}>Search</button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
        <div className="card space-y-3">
          <h2 className="text-lg font-bold text-navy">Submissions</h2>
          {loading ? <p className="text-sm text-muted">Loading review queue...</p> : null}
          {!loading && items.length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-muted">No clinical records match this filter.</p> : null}
          <div className="space-y-2">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pickRecord(item)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected?.id === item.id ? 'border-primary bg-red-50' : 'border-gray-100 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-navy">{item.firstName ?? item.donor?.fullName ?? 'Unnamed'} {item.lastName ?? ''}</p>
                    <p className="text-xs text-muted">{item.email ?? item.donor?.user?.email ?? 'No email'} - {item.selectedHospital?.hospitalName ?? 'No hospital'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-[11px] font-bold ${badgeClass[item.status] ?? 'bg-gray-100 text-gray-700'}`}>{statusLabels[item.status] ?? item.status}</span>
                </div>
                {item.donorRiskFlag ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">Risk answers require review</p> : null}
              </button>
            ))}
          </div>
        </div>

        {!selected ? (
          <div className="card flex min-h-[420px] items-center justify-center text-center">
            <div>
              <h2 className="text-xl font-bold text-navy">Select a clinical record</h2>
              <p className="mt-2 text-sm text-muted">The selected donor record will appear here with questionnaire answers, workflow actions, and office-use sections.</p>
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Clinical record</p>
                  <h2 className="text-2xl font-bold text-navy">{selectedName}</h2>
                  <p className="text-sm text-muted">{selected.email ?? selected.donor?.user?.email} - {selected.phoneNumber ?? 'No phone'}</p>
                </div>
                <button type="button" className="rounded-xl border border-red-200 px-4 py-2 font-bold text-primary" onClick={() => downloadClinicalRecordExport(selected.id)}>Export Record</button>
              </div>
              <Workflow status={selected.status} />
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Info label="Blood group" value={selected.donor?.bloodGroup ?? 'Not set'} />
                <Info label="Residence" value={selected.areaOfResidence ?? selected.donor?.location ?? 'Not set'} />
                <Info label="Review hospital" value={selected.selectedHospital?.hospitalName ?? 'Not selected'} />
              </div>
            </div>

            <div className="card space-y-3">
              <h3 className="text-lg font-bold text-navy">Health Questionnaire</h3>
              <div className="grid gap-2">
                {(selected.healthAnswers ?? []).map((answer) => (
                  <div key={answer.questionKey} className="rounded-xl border border-gray-100 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-navy">{answer.questionKey}. {answer.questionText}</p>
                      <span className={`rounded-full px-3 py-1 text-xs font-bold ${answer.answer ? 'bg-amber-50 text-amber-800' : 'bg-green-50 text-green-700'}`}>{answer.answer ? 'YES' : 'NO'}</span>
                    </div>
                    {answer.details ? <p className="mt-2 text-sm text-muted">{answer.details}</p> : null}
                  </div>
                ))}
              </div>
            </div>

            <div className="card space-y-3">
              <h3 className="text-lg font-bold text-navy">Review Action</h3>
              <textarea className="legacy-input" rows={3} placeholder="Reviewer notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button disabled={saving} type="button" className="btn-primary" onClick={() => runAction(() => updateClinicalReview(selected.id, { status: 'HOSPITAL_REVIEW', reviewNotes }), 'Hospital review started.')}>Start Review</button>
                <button disabled={saving} type="button" className="rounded-xl border border-red-200 px-4 py-2 font-bold text-primary" onClick={() => runAction(() => updateClinicalReview(selected.id, { status: 'OFFICE_USE_COMPLETED', reviewNotes }), 'Record moved to office-use completed.')}>Mark Office-Use Pending</button>
              </div>
            </div>

            <OfficeUseForm value={office} onChange={setOffice} onSave={() => runAction(() => updateOfficeUse(selected.id, cleanPayload(office)), 'Office-use section saved.')} saving={saving} />
            <DonationOutcomeForm value={donation} onChange={setDonation} onSave={() => runAction(() => updateDonationOutcome(selected.id, cleanPayload(donation)), 'Donation outcome saved.')} saving={saving} disabled={selected.status !== 'APPROVED'} />
          </div>
        )}
      </div>
    </section>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-xs font-bold uppercase text-gray-500">{label}</p><p className="mt-1 font-semibold text-navy">{value}</p></div>;
}

function Workflow({ status }: { status: string }) {
  const finalStage = status.includes('DEFERRED') || status === 'REJECTED' ? status : 'APPROVED';
  const stages = ['SUBMITTED', 'HOSPITAL_REVIEW', 'OFFICE_USE_COMPLETED', finalStage];
  const current = Math.max(0, stages.indexOf(status));
  return <div className="mt-4 grid gap-2 md:grid-cols-4">{stages.map((stage, index) => <div key={`${stage}-${index}`} className={`rounded-xl border p-3 text-xs font-bold ${index <= current ? 'border-red-200 bg-red-50 text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>{statusLabels[stage] ?? stage}</div>)}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1"><span className="text-sm font-bold text-navy">{label}</span>{children}</label>;
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (value: string) => void }) {
  return <Field label={label}><select className="legacy-input" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option || 'empty'} value={option}>{option || 'Select'}</option>)}</select></Field>;
}

function OfficeUseForm({ value, onChange, onSave, saving }: { value: Record<string, any>; onChange: (next: Record<string, any>) => void; onSave: () => void; saving: boolean }) {
  const set = (key: string, next: any) => onChange({ ...value, [key]: next });
  return <div className="card space-y-4"><h3 className="text-lg font-bold text-navy">Office Use: Donor Selection</h3><div className="grid gap-3 md:grid-cols-3"><SelectField label="Appearance" value={value.appearancePassed} options={passFail} onChange={(next) => set('appearancePassed', next)} /><SelectField label="Medical history" value={value.medicalHistoryPassed} options={passFail} onChange={(next) => set('medicalHistoryPassed', next)} /><Field label="Weight (kg)"><input className="legacy-input" type="number" value={value.weightKg ?? ''} onChange={(event) => set('weightKg', Number(event.target.value))} /></Field><Field label="Blood pressure"><input className="legacy-input" value={value.bloodPressure ?? ''} onChange={(event) => set('bloodPressure', event.target.value)} placeholder="120/80" /></Field><Field label="Pulse BPM"><input className="legacy-input" type="number" value={value.pulseBpm ?? ''} onChange={(event) => set('pulseBpm', Number(event.target.value))} /></Field><Field label="Haemoglobin"><input className="legacy-input" type="number" step="0.1" value={value.haemoglobinLevel ?? ''} onChange={(event) => set('haemoglobinLevel', Number(event.target.value))} /></Field><SelectField label="CuSO4 Hb" value={value.hbByCuSO4Passed} options={passFail} onChange={(next) => set('hbByCuSO4Passed', next)} /><SelectField label="HBsAg checked" value={value.hbSagChecked} options={yesNo} onChange={(next) => set('hbSagChecked', next)} /><Field label="HBsAg result"><input className="legacy-input" value={value.hbSagResult ?? ''} onChange={(event) => set('hbSagResult', event.target.value)} /></Field><SelectField label="Qualifies" value={value.qualifiesToDonate} options={yesNo} onChange={(next) => set('qualifiesToDonate', next)} /><SelectField label="Screening outcome" value={value.outcomeOfScreening} options={screeningOutcomes} onChange={(next) => set('outcomeOfScreening', next)} /><Field label="Temporary deferral duration"><input className="legacy-input" value={value.temporaryDeferralDuration ?? ''} onChange={(event) => set('temporaryDeferralDuration', event.target.value)} placeholder="1 week, 1 month, 6 months" /></Field><Field label="Nurse name"><input className="legacy-input" value={value.nurseName ?? ''} onChange={(event) => set('nurseName', event.target.value)} /></Field><Field label="Nurse signature"><input className="legacy-input" value={value.nurseSignature ?? ''} onChange={(event) => set('nurseSignature', event.target.value)} placeholder="Signature placeholder" /></Field></div><textarea className="legacy-input" rows={3} placeholder="Office comments" value={value.comments ?? ''} onChange={(event) => set('comments', event.target.value)} /><button disabled={saving} type="button" className="btn-primary" onClick={onSave}>Save Office Use</button></div>;
}

function DonationOutcomeForm({ value, onChange, onSave, saving, disabled }: { value: Record<string, any>; onChange: (next: Record<string, any>) => void; onSave: () => void; saving: boolean; disabled: boolean }) {
  const set = (key: string, next: any) => onChange({ ...value, [key]: next });
  return <div className={`card space-y-4 ${disabled ? 'opacity-70' : ''}`}><div><h3 className="text-lg font-bold text-navy">Blood Donation Outcome</h3>{disabled ? <p className="text-sm text-muted">Donation outcome becomes available after the donor is approved.</p> : null}</div><div className="grid gap-3 md:grid-cols-3"><Field label="Donation number"><input disabled={disabled} className="legacy-input" value={value.donationNumber ?? ''} onChange={(event) => set('donationNumber', event.target.value)} /></Field><SelectField label="Pack type" value={value.packType} options={packTypes} onChange={(next) => set('packType', next)} /><SelectField label="Phlebotomy outcome" value={value.outcomeOfPhlebotomy} options={phlebotomyOutcomes} onChange={(next) => set('outcomeOfPhlebotomy', next)} /><Field label="Bleed start"><input disabled={disabled} className="legacy-input" type="datetime-local" value={value.bleedStartTime ?? ''} onChange={(event) => set('bleedStartTime', event.target.value)} /></Field><Field label="Bleed end"><input disabled={disabled} className="legacy-input" type="datetime-local" value={value.bleedEndTime ?? ''} onChange={(event) => set('bleedEndTime', event.target.value)} /></Field><Field label="Underbled ml"><input disabled={disabled} className="legacy-input" type="number" value={value.underbledMl ?? ''} onChange={(event) => set('underbledMl', Number(event.target.value))} /></Field><Field label="Nurse name"><input disabled={disabled} className="legacy-input" value={value.nurseName ?? ''} onChange={(event) => set('nurseName', event.target.value)} /></Field><Field label="Nurse signature"><input disabled={disabled} className="legacy-input" value={value.nurseSignature ?? ''} onChange={(event) => set('nurseSignature', event.target.value)} /></Field></div><textarea disabled={disabled} className="legacy-input" rows={2} placeholder="Unsuccessful reason or adverse event notes" value={value.unsuccessfulReason ?? ''} onChange={(event) => set('unsuccessfulReason', event.target.value)} /><button disabled={saving || disabled} type="button" className="btn-primary" onClick={onSave}>Save Donation Outcome</button></div>;
}

function cleanPayload(payload: Record<string, any>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}

