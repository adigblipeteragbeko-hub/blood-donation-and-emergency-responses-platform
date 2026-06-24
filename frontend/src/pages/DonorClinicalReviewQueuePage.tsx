import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';
import { confirmedBloodGroups } from '../constants/blood-groups';
import {
  ClinicalStatus,
  DonorClinicalRecord,
  downloadClinicalRecordExport,
  getClinicalReviewQueue,
  updateClinicalReview,
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
  SUBMITTED: 'Submitted',
  HOSPITAL_REVIEW: 'Hospital Review',
  OFFICE_USE_PENDING: 'Office Use Pending',
  OFFICE_USE_COMPLETED: 'Office Use Completed',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  TEMPORARILY_DEFERRED: 'Deferred',
  PERMANENTLY_DEFERRED: 'Deferred',
};

const badgeClass: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-700 ring-gray-200',
  SUBMITTED: 'bg-blue-50 text-blue-700 ring-blue-200',
  HOSPITAL_REVIEW: 'bg-amber-50 text-amber-800 ring-amber-200',
  OFFICE_USE_PENDING: 'bg-purple-50 text-purple-700 ring-purple-200',
  OFFICE_USE_COMPLETED: 'bg-teal-50 text-teal-700 ring-teal-200',
  APPROVED: 'bg-green-50 text-green-700 ring-green-200',
  REJECTED: 'bg-red-50 text-red-700 ring-red-200',
  TEMPORARILY_DEFERRED: 'bg-amber-50 text-amber-800 ring-amber-200',
  PERMANENTLY_DEFERRED: 'bg-amber-100 text-amber-900 ring-amber-300',
};

const passFail = ['', 'PASSED', 'FAILED'];
const yesNo = ['', 'YES', 'NO'];
const screeningOutcomes = ['', 'QUALIFIED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED', 'REJECTED'];
const finalStatuses = new Set(['APPROVED', 'REJECTED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED']);
const riskQuestionKeys = new Set(['q2', 'q3', 'q4', 'q5', 'q6', 'q7', 'q8', 'q9', 'q10', 'q12', 'q13', 'q14', 'q15', 'q16', 'q17', 'q18', 'q19', 'q20', 'q21', 'q22']);

const questionGroups = [
  { title: 'General Health', keys: ['q1', 'q2', 'q3', 'q4', 'q5', 'q7', 'q8', 'q11'] },
  { title: 'Recent Medical Procedures', keys: ['q6', 'q10', 'q12', 'q13', 'q14'] },
  { title: 'Risk Assessment', keys: ['q9', 'q16', 'q17', 'q18', 'q19'] },
  { title: "Women's Health", keys: ['q22'] },
  { title: 'Other Safety Questions', keys: ['q15', 'q20', 'q21'] },
];

export default function DonorClinicalReviewQueuePage() {
  const { user } = useAuth();
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

  const isAdminOverride = user?.role === 'ADMIN' || user?.role === 'SUPER_ADMIN';

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
      setError(friendlyError(err, 'Could not load donor clinical review queue.'));
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
    return [selected.lastName, selected.firstName, selected.otherNames].filter(Boolean).join(' ') || selected.donor?.fullName || 'Unnamed donor';
  }, [selected]);

  const pickRecord = (record: DonorClinicalRecord) => {
    setSelected(record);
    setReviewNotes(record.reviewNotes ?? '');
    setOffice({ outcomeOfScreening: record.clinicalReview?.outcomeOfScreening ?? 'QUALIFIED', qualifiesToDonate: record.clinicalReview?.qualifiesToDonate ?? 'YES', ...record.clinicalReview });
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
      setError(friendlyError(err, 'Action failed. Please check the required fields.'));
    } finally {
      setSaving(false);
    }
  };

  const selectedStatusKey = selected ? displayStatusKey(selected) : '';
  const decisionLocked = selected ? finalStatuses.has(selected.status) && !isAdminOverride : false;
  const officeLocked = selected
    ? Boolean(selected.clinicalReview) && ['OFFICE_USE_COMPLETED', 'APPROVED', 'REJECTED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED'].includes(selected.status) && !isAdminOverride
    : false;

  const saveOfficeUse = () => {
    if (!String(office.nurseName ?? '').trim()) {
      setError('Please provide the nurse name before completing Office Use.');
      return;
    }
    if (!selected) return;
    void runAction(() => updateOfficeUse(selected.id, cleanPayload(office)), 'Office Use completed and locked.');
  };

  const printScreeningReport = () => {
    if (!selected) return;
    const printWindow = window.open('', '_blank', 'width=980,height=720');
    if (!printWindow) {
      setError('Unable to open screening report. Please allow pop-ups for this site.');
      return;
    }
    printWindow.document.write(buildReportHtml(selected, selectedName));
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
    setMessage('Screening report opened.');
  };

  return (
    <section className="mx-auto max-w-[1800px] space-y-5 px-2 sm:px-4 xl:px-6">
      <div className="rounded-3xl border border-red-100 bg-gradient-to-br from-red-50 via-white to-white p-5 shadow-sm sm:p-6">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">Office use only</p>
        <h1 className="mt-1 text-2xl font-black text-primary sm:text-3xl">Donor Clinical Review</h1>
        <p className="mt-2 max-w-3xl text-sm text-gray-600">Review submitted donor records, complete screening, confirm blood group, and make the clinical eligibility decision.</p>
      </div>

      {message ? <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm grid gap-3 lg:grid-cols-[240px_1fr_auto]">
        <select className="legacy-input" value={status} onChange={(event) => setStatus(event.target.value)}>
          {statuses.map((item) => <option key={item || 'ALL'} value={item}>{item ? statusLabels[item] : 'All records'}</option>)}
        </select>
        <input className="legacy-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search donor name, reference, or email" />
        <button type="button" className="btn-primary" onClick={() => loadQueue()}>Search</button>
      </div>

      <div className="grid gap-5 2xl:grid-cols-[480px_minmax(0,1fr)]">
        <aside className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm xl:p-5 space-y-3">
          <h2 className="text-lg font-bold text-navy">Submitted Records</h2>
          {loading ? <p className="text-sm text-muted">Loading review queue...</p> : null}
          {!loading && items.length === 0 ? <p className="rounded-xl bg-gray-50 p-4 text-sm text-muted">No clinical records match this filter.</p> : null}
          <div className="max-h-[78vh] space-y-2 overflow-y-auto pr-1">
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => pickRecord(item)}
                className={`w-full rounded-2xl border p-4 text-left transition hover:-translate-y-0.5 hover:shadow-md ${selected?.id === item.id ? 'border-primary bg-red-50' : 'border-gray-100 bg-white'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold text-navy">{[item.lastName, item.firstName, item.otherNames].filter(Boolean).join(' ') || item.donor?.fullName || 'Unnamed'}</p>
                    <p className="text-xs text-muted">{item.donor?.donorNumber ?? item.donorCardNumber ?? 'No donor reference'} - {item.selectedHospital?.hospitalName ?? 'No hospital'}</p>
                  </div>
                  <StatusBadge statusKey={displayStatusKey(item)} />
                </div>
                {item.donorRiskFlag ? <p className="mt-2 rounded-lg bg-amber-50 p-2 text-xs font-semibold text-amber-800">Risk answers require review</p> : null}
              </button>
            ))}
          </div>
        </aside>

        {!selected ? (
          <div className="rounded-3xl border border-dashed border-gray-200 bg-white p-10 text-center shadow-sm">
            <div>
              <h2 className="text-xl font-bold text-navy">Select a clinical record</h2>
              <p className="mt-2 text-sm text-muted">The selected donor record will appear here with questionnaire answers, workflow actions, and office-use sections.</p>
            </div>
          </div>
        ) : (
          <main className="min-w-0 space-y-5">
            <div className="card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-primary">Clinical record</p>
                  <h2 className="text-2xl font-bold text-navy">{selectedName}</h2>
                  <p className="text-sm text-muted">{selected.email ?? selected.donor?.user?.email} - {selected.phoneNumber ?? 'No phone'}</p>
                </div>
                <div className="flex flex-wrap gap-2"><StatusBadge statusKey={selectedStatusKey} /><button type="button" className="rounded-xl border border-red-200 px-4 py-2 font-bold text-primary" onClick={printScreeningReport}>Print Screening Report</button><button type="button" className="rounded-xl border border-gray-200 px-4 py-2 font-bold text-navy" onClick={() => downloadClinicalRecordExport(selected.id)}>Export Text</button></div>
              </div>
              <Workflow status={selected.status} hasOfficeReview={Boolean(selected.clinicalReview)} />
              {decisionLocked ? <p className="mt-4 rounded-xl bg-gray-50 p-3 text-sm font-semibold text-gray-700">This decision has been finalized.</p> : null}
              {officeLocked ? <p className="mt-4 rounded-xl bg-teal-50 p-3 text-sm font-semibold text-teal-700">Office Use completed. Screening details are locked for audit integrity.</p> : null}
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <Info label="Donor reference" value={selected.donor?.donorNumber ?? selected.donorCardNumber ?? 'Not assigned'} />
                <Info label="Blood group" value={selected.donor?.bloodGroup === 'UNKNOWN' ? 'Pending Hospital Blood Group Confirmation' : selected.donor?.bloodGroup ?? 'Not set'} />
                <Info label="Area / Community" value={selected.areaOfResidence ?? selected.donor?.location ?? 'Not set'} />
                <Info label="Digital address" value={selected.addressOrWorkplace ?? 'Not provided'} />
                <Info label="Document" value={[selected.idType, selected.idNumber].filter(Boolean).join(' - ') || 'Not provided'} />
                <Info label="Review hospital" value={selected.selectedHospital?.hospitalName ?? 'Not selected'} />
                <Info label="Venue" value={selected.venue ?? selected.selectedHospital?.location ?? 'Not set'} />
                <Info label="Date created" value={formatDate(selected.createdAt)} />
                <Info label="Date submitted" value={formatDate(selected.submittedAt)} />
              </div>
              {selected.donorType === 'REPLACEMENT_FAMILY' ? (
                <div className="mt-4 rounded-2xl border border-amber-100 bg-amber-50 p-4">
                  <p className="text-sm font-bold text-amber-900">Replacement donor details</p>
                  <div className="mt-3 grid gap-3 md:grid-cols-4">
                    <Info label="Patient" value={selected.patientName ?? 'Not set'} />
                    <Info label="Request reference" value={selected.requestReference ?? 'Not set'} />
                    <Info label="Hospital" value={selected.patientHospital ?? selected.selectedHospital?.hospitalName ?? 'Not set'} />
                    <Info label="Relationship" value={selected.relationshipToPatient ?? 'Not set'} />
                  </div>
                </div>
              ) : null}
            </div>

            <Questionnaire record={selected} />

            <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm xl:p-6 space-y-3">
              <h3 className="text-lg font-bold text-navy">Review Action</h3>
              <textarea disabled={decisionLocked} className="legacy-input" rows={3} placeholder="Reviewer notes" value={reviewNotes} onChange={(event) => setReviewNotes(event.target.value)} />
              <div className="flex flex-wrap gap-2">
                <button disabled={saving || decisionLocked} type="button" className="btn-primary" onClick={() => runAction(() => updateClinicalReview(selected.id, { status: 'HOSPITAL_REVIEW', reviewNotes }), 'Review started successfully.')}>Start Review</button>
                <button disabled={saving || decisionLocked} type="button" className="rounded-xl border border-red-200 px-4 py-2 font-bold text-primary" onClick={() => runAction(() => updateClinicalReview(selected.id, { status: 'HOSPITAL_REVIEW', reviewNotes }), 'Record marked ready for office-use screening.')}>Mark Office Use Pending</button>
              </div>
            </div>

            <OfficeUseForm currentBloodGroup={selected.donor?.bloodGroup ?? 'UNKNOWN'} value={office} onChange={setOffice} onSave={saveOfficeUse} saving={saving} disabled={officeLocked || decisionLocked} />
            {selected.status === 'APPROVED' ? <PostScreeningGuidance /> : null}
          </main>
        )}
      </div>
    </section>
  );
}

function PostScreeningGuidance() {
  return (
    <div className="rounded-3xl border border-green-100 bg-green-50 p-5 shadow-sm xl:p-6">
      <h3 className="text-lg font-bold text-green-900">Screening Complete</h3>
      <p className="mt-2 text-sm font-semibold text-green-800">
        Donor has passed screening and is eligible for appointment scheduling. Blood donation will be recorded when the appointment is completed.
      </p>
    </div>
  );
}

function displayStatusKey(record: DonorClinicalRecord) {
  if (record.status === 'HOSPITAL_REVIEW' && !record.clinicalReview) return 'OFFICE_USE_PENDING';
  return record.status;
}

function StatusBadge({ statusKey }: { statusKey: string }) {
  return <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-black ring-1 ${badgeClass[statusKey] ?? 'bg-gray-100 text-gray-700 ring-gray-200'}`}>{statusLabels[statusKey] ?? statusKey}</span>;
}

function Info({ label, value }: { label: string; value: ReactNode }) {
  return <div className="rounded-xl border border-gray-100 bg-gray-50 p-3"><p className="text-xs font-bold uppercase text-gray-500">{label}</p><p className="mt-1 break-words font-semibold text-navy">{value}</p></div>;
}

function formatDate(value?: string | null) {
  if (!value) return 'Not recorded';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not recorded' : date.toLocaleString();
}

function Workflow({ status, hasOfficeReview }: { status: string; hasOfficeReview: boolean }) {
  const effectiveStatus = status === 'HOSPITAL_REVIEW' && !hasOfficeReview ? 'OFFICE_USE_PENDING' : status;
  const finalStage = effectiveStatus.includes('DEFERRED') || effectiveStatus === 'REJECTED' ? effectiveStatus : 'APPROVED';
  const stages = ['SUBMITTED', 'HOSPITAL_REVIEW', 'OFFICE_USE_PENDING', 'OFFICE_USE_COMPLETED', finalStage];
  const current = Math.max(0, stages.indexOf(effectiveStatus));
  return <div className="mt-5 grid gap-2 md:grid-cols-5">{stages.map((stage, index) => <div key={`${stage}-${index}`} className={`rounded-xl border p-3 text-xs font-bold ${index <= current ? 'border-red-200 bg-red-50 text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>{statusLabels[stage] ?? stage}</div>)}</div>;
}

function Questionnaire({ record }: { record: DonorClinicalRecord }) {
  const answers = record.healthAnswers ?? [];
  return <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm xl:p-6"><div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-lg font-bold text-navy">Health Questionnaire</h3><p className="text-sm text-muted">Grouped for faster screening review. Risk answers are highlighted.</p></div>{record.donorRiskFlag ? <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-black text-amber-800 ring-1 ring-amber-200">Risk answers present</span> : null}</div><div className="mt-4 space-y-4">{questionGroups.map((group) => { const groupAnswers = answers.filter((answer) => group.keys.includes(answer.questionKey)); if (!groupAnswers.length) return null; return <div key={group.title} className="rounded-2xl border border-gray-100 p-4"><h4 className="font-bold text-navy">{group.title}</h4><div className="mt-3 grid gap-2">{groupAnswers.map((answer) => <QuestionAnswer key={answer.questionKey} answer={answer} />)}</div></div>; })}</div></div>;
}

function QuestionAnswer({ answer }: { answer: NonNullable<DonorClinicalRecord['healthAnswers']>[number] }) {
  const riskyYes = answer.answer && riskQuestionKeys.has(answer.questionKey);
  return <div className={`rounded-xl border p-3 ${riskyYes ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-white'}`}><div className="flex flex-wrap items-start justify-between gap-2"><p className="max-w-4xl text-sm font-semibold text-navy">{answer.questionKey}. {answer.questionText}</p><span className={`rounded-full px-3 py-1 text-xs font-black ${riskyYes ? 'bg-amber-100 text-amber-900' : answer.answer ? 'bg-blue-50 text-blue-700' : 'bg-green-50 text-green-700'}`}>{answer.answer ? 'YES' : 'NO'}{riskyYes ? ' - REVIEW' : ''}</span></div>{answer.details ? <p className="mt-2 text-sm text-muted">{answer.details}</p> : null}</div>;
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <label className="space-y-1"><span className="text-sm font-bold text-navy">{label}</span>{children}</label>;
}

function SelectField({ label, value, options, onChange, disabled }: { label: string; value: string; options: string[]; onChange: (value: string) => void; disabled?: boolean }) {
  return <Field label={label}><select disabled={disabled} className="legacy-input" value={value ?? ''} onChange={(event) => onChange(event.target.value)}>{options.map((option) => <option key={option || 'empty'} value={option}>{option || 'Select'}</option>)}</select></Field>;
}

function OfficeUseForm({ currentBloodGroup, value, onChange, onSave, saving, disabled }: { currentBloodGroup: string; value: Record<string, any>; onChange: (next: Record<string, any>) => void; onSave: () => void; saving: boolean; disabled: boolean }) {
  const set = (key: string, next: any) => onChange({ ...value, [key]: next });
  return <div className={`rounded-3xl border border-gray-100 bg-white p-5 shadow-sm xl:p-6 ${disabled ? 'opacity-80' : ''}`}><div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-lg font-bold text-navy">Office Use: Donor Selection</h3><p className="text-sm text-muted">Confirm clinical screening details and final medical screening outcome.</p></div>{disabled ? <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-black text-teal-700">Locked</span> : null}</div>{currentBloodGroup === 'UNKNOWN' ? <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm font-semibold text-amber-800">Blood Group Not Yet Confirmed. Confirm the donor blood group before approving eligibility.</p> : null}<div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4"><Field label="Confirmed blood group"><select disabled={disabled} className="legacy-input" value={value.confirmedBloodGroup ?? ''} onChange={(event) => set('confirmedBloodGroup', event.target.value)}><option value="">Keep current ({currentBloodGroup})</option>{confirmedBloodGroups.map((group) => <option key={group.value} value={group.value}>{group.label}</option>)}</select></Field><SelectField disabled={disabled} label="Appearance" value={value.appearancePassed} options={passFail} onChange={(next) => set('appearancePassed', next)} /><SelectField disabled={disabled} label="Medical history" value={value.medicalHistoryPassed} options={passFail} onChange={(next) => set('medicalHistoryPassed', next)} /><Field label="Weight (kg)"><input disabled={disabled} className="legacy-input" type="number" value={value.weightKg ?? ''} onChange={(event) => set('weightKg', Number(event.target.value))} /></Field><Field label="Blood pressure"><input disabled={disabled} className="legacy-input" value={value.bloodPressure ?? ''} onChange={(event) => set('bloodPressure', event.target.value)} placeholder="120/80" /></Field><Field label="Pulse BPM"><input disabled={disabled} className="legacy-input" type="number" value={value.pulseBpm ?? ''} onChange={(event) => set('pulseBpm', Number(event.target.value))} /></Field><Field label="Haemoglobin"><input disabled={disabled} className="legacy-input" type="number" step="0.1" value={value.haemoglobinLevel ?? ''} onChange={(event) => set('haemoglobinLevel', Number(event.target.value))} /></Field><SelectField disabled={disabled} label="CuSO4 Hb" value={value.hbByCuSO4Passed} options={passFail} onChange={(next) => set('hbByCuSO4Passed', next)} /><SelectField disabled={disabled} label="HBsAg checked" value={value.hbSagChecked} options={yesNo} onChange={(next) => set('hbSagChecked', next)} /><Field label="HBsAg result"><input disabled={disabled} className="legacy-input" value={value.hbSagResult ?? ''} onChange={(event) => set('hbSagResult', event.target.value)} /></Field><SelectField disabled={disabled} label="Qualifies" value={value.qualifiesToDonate} options={yesNo} onChange={(next) => set('qualifiesToDonate', next)} /><SelectField disabled={disabled} label="Screening outcome" value={value.outcomeOfScreening} options={screeningOutcomes} onChange={(next) => set('outcomeOfScreening', next)} /><Field label="Temporary deferral duration"><input disabled={disabled} className="legacy-input" value={value.temporaryDeferralDuration ?? ''} onChange={(event) => set('temporaryDeferralDuration', event.target.value)} placeholder="1 week, 1 month, 6 months" /></Field><Field label="Nurse name"><input disabled={disabled} className="legacy-input" value={value.nurseName ?? ''} onChange={(event) => set('nurseName', event.target.value)} /></Field></div><textarea disabled={disabled} className="legacy-input mt-3" rows={3} placeholder="Office comments" value={value.comments ?? ''} onChange={(event) => set('comments', event.target.value)} /><button disabled={saving || disabled} type="button" className="btn-primary mt-3" onClick={onSave}>Save / Complete Office Use</button></div>;
}

function cleanPayload(payload: Record<string, any>) {
  return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== '' && value !== null && value !== undefined));
}











function friendlyError(err: any, fallback: string) {
  const raw = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message;
  const message = Array.isArray(raw) ? raw.join(' ') : String(raw ?? '');
  if (message.includes('confirmedBloodGroup')) return 'Confirm the donor blood group before approving eligibility.';
  if (message.includes('Unauthorized') || message.includes('Forbidden')) return 'You are not authorized to perform this action.';
  return message || fallback;
}

function buildReportHtml(record: DonorClinicalRecord, donorName: string) {
  const answers = record.healthAnswers ?? [];
  const answerRows = answers.map((answer) => `<tr><td>${escapeHtml(answer.questionKey)}</td><td>${escapeHtml(answer.questionText)}</td><td>${answer.answer ? 'YES' : 'NO'}</td><td>${escapeHtml(answer.details ?? '')}</td></tr>`).join('');
  const clinicalReview = record.clinicalReview ?? {};
  return `<!doctype html><html><head><title>Donor Screening Report</title><style>body{font-family:Arial,sans-serif;color:#0f172a;margin:32px}h1{color:#b91c1c}section{margin:20px 0;padding:16px;border:1px solid #e5e7eb;border-radius:12px}table{width:100%;border-collapse:collapse}td,th{border:1px solid #e5e7eb;padding:8px;text-align:left;vertical-align:top}.muted{color:#64748b}.badge{display:inline-block;padding:4px 10px;border-radius:999px;background:#fee2e2;color:#991b1b;font-weight:700}@media print{button{display:none}}</style></head><body><h1>Donor Screening Report</h1><p class="muted">Generated ${new Date().toLocaleString()}</p><section><h2>Donor Summary</h2><p><strong>Name:</strong> ${escapeHtml(donorName)}</p><p><strong>Donor Reference:</strong> ${escapeHtml(record.donor?.donorNumber ?? record.donorCardNumber ?? 'Not assigned')}</p><p><strong>Blood Group:</strong> ${escapeHtml(record.donor?.bloodGroup ?? 'Not set')}</p><p><strong>Status:</strong> <span class="badge">${escapeHtml(statusLabels[displayStatusKey(record)] ?? record.status)}</span></p><p><strong>Review Hospital:</strong> ${escapeHtml(record.selectedHospital?.hospitalName ?? 'Not selected')}</p><p><strong>Submitted:</strong> ${escapeHtml(formatDate(record.submittedAt))}</p><p><strong>Reviewed:</strong> ${escapeHtml(formatDate(record.hospitalReviewedAt ?? clinicalReview.reviewedAt))}</p></section><section><h2>Health Questionnaire</h2><table><thead><tr><th>No.</th><th>Question</th><th>Answer</th><th>Details</th></tr></thead><tbody>${answerRows}</tbody></table></section><section><h2>Office Use Screening</h2><p><strong>Screening Outcome:</strong> ${escapeHtml(clinicalReview.outcomeOfScreening ?? 'Not recorded')}</p><p><strong>Qualifies:</strong> ${escapeHtml(clinicalReview.qualifiesToDonate ?? 'Not recorded')}</p><p><strong>Weight:</strong> ${escapeHtml(String(clinicalReview.weightKg ?? 'Not recorded'))}</p><p><strong>Blood pressure:</strong> ${escapeHtml(clinicalReview.bloodPressure ?? 'Not recorded')}</p><p><strong>Haemoglobin:</strong> ${escapeHtml(String(clinicalReview.haemoglobinLevel ?? 'Not recorded'))}</p><p><strong>Nurse:</strong> ${escapeHtml(clinicalReview.nurseName ?? 'Not recorded')}</p><p><strong>Comments:</strong> ${escapeHtml(clinicalReview.comments ?? '')}</p></section><button onclick="window.print()">Print</button></body></html>`;
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char] ?? char));
}


