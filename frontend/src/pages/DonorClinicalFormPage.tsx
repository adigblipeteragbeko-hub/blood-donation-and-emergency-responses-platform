import { FormEvent, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
  DonorClinicalRecord,
  HealthAnswer,
  getMyClinicalRecords,
  saveClinicalDraft,
  submitClinicalRecord,
  downloadClinicalRecordExport,
} from '../services/donor-clinical-records';

const questions = [
  'Are you feeling well today, with no fever, cough, headache or cold?',
  'Have you ever been deferred as a blood donor or told not to donate blood?',
  'Are you taking any medication?',
  'Have you had or do you have epilepsy, stomach ulcer, heart disease or cancer?',
  'Have you had tuberculosis?',
  'Have you been vaccinated in the last 4 weeks?',
  'Have you had jaundice, liver disease or a positive blood test for hepatitis?',
  'Do you have sickle cell disease?',
  'Have you ever injected yourself with drugs or medication?',
  'In the last 6 months, have you had a needle-stick injury, injection outside a hospital/clinic, or tattoo/body piercing?',
  'Have you ever had a headache?',
  'Have you had dental treatment in the last 1 week or are you taking antibiotics now?',
  'Have you had surgery with general anaesthesia in the last 6 months?',
  'Have you received blood or blood component transfusion in the last 6 months?',
  'Have you lost more than 5kg in weight unintentionally in the last 6 months?',
  'Have you had unprotected sex with more than one partner or been paid/paid someone for sex in the last 6 months?',
  'Have you had gonorrhoea, genital or urinary pain/discharge?',
  'For men only: have you had sex with a man in the last 6 months?',
  'Have you or your partner ever tested positive for HIV/AIDS?',
  'After donation, are you going to take part in vigorous activity such as climbing, driving heavy vehicles, operating heavy machinery, or working at heights?',
  'Are you donating because you were told you have too much blood?',
  'Have you been pregnant in the last 12 months or are you currently breastfeeding?',
].map((questionText, index) => ({ questionKey: `q${index + 1}`, questionText }));

const steps = ['Personal', 'History', 'Replacement', 'Health', 'Declaration'];

const emptyForm = {
  selectedHospitalId: '', formDate: '', venue: '', title: '', firstName: '', lastName: '', callingName: '', dateOfBirth: '', sex: '', areaOfResidence: '', addressOrWorkplace: '', occupation: '', idType: '', idNumber: '', phoneNumber: '', email: '', preferredContactMethod: 'SMS', doNotContactForDonation: false,
  donorType: 'VOLUNTARY', hasDonatedBefore: false, lastDonationDate: '', numberOfVoluntaryDonations: 0, numberOfReplacementDonations: 0, donorCardNumber: '',
  patientName: '', patientHospital: '', ward: '', relationshipToPatient: '', clerkingOfficerName: '', clerkingOfficerSignature: '',
  declarationConfirmed: false, testingConsent: false, contactConsent: true, staffEligibilityConsent: false, dataUseConsent: false, donorSignature: '', declarationDate: new Date().toISOString().slice(0, 10), counsellorName: '', counsellorSignature: '',
};

export default function DonorClinicalFormPage() {
  const [step, setStep] = useState(0);
  const [record, setRecord] = useState<DonorClinicalRecord | null>(null);
  const [form, setForm] = useState<any>(emptyForm);
  const [answers, setAnswers] = useState<Record<string, { answer: '' | 'yes' | 'no'; details: string }>>(
    Object.fromEntries(questions.map((q) => [q.questionKey, { answer: '', details: '' }])),
  );
  const [hospitals, setHospitals] = useState<Array<{ id: string; hospitalName: string; location: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const locked = record ? record.status !== 'DRAFT' : false;

  useEffect(() => {
    void (async () => {
      try {
        const [mine, hospitalResponse] = await Promise.all([getMyClinicalRecords(), api.get('/donors/hospital-options')]);
        const latest = mine.latest;
        setRecord(latest);
        if (latest) {
          setForm((prev: any) => ({ ...prev, ...Object.fromEntries(Object.entries(latest).filter(([, v]) => v !== null && typeof v !== 'object')) }));
          if (latest.selectedHospitalId) setForm((prev: any) => ({ ...prev, selectedHospitalId: latest.selectedHospitalId }));
          if (latest.healthAnswers?.length) {
            setAnswers(Object.fromEntries(questions.map((q) => {
              const found = latest.healthAnswers?.find((a) => a.questionKey === q.questionKey);
              return [q.questionKey, { answer: found ? (found.answer ? 'yes' : 'no') : '', details: found?.details ?? '' }];
            })));
          }
        }
        setHospitals(hospitalResponse.data?.data ?? hospitalResponse.data ?? []);
      } catch {
        setError('Could not load clinical record workspace.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const healthAnswers: HealthAnswer[] = useMemo(() => questions
    .filter((q) => answers[q.questionKey]?.answer)
    .map((q) => ({
      ...q,
      answer: answers[q.questionKey]?.answer === 'yes',
      details: answers[q.questionKey]?.details,
    })), [answers]);

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const saved = await saveClinicalDraft({ ...form, healthAnswers }, record?.id);
      setRecord(saved);
      setMessage('Draft saved. You can continue later.');
      return saved;
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Could not save draft.');
      return null;
    } finally { setSaving(false); }
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (healthAnswers.length < questions.length) {
      setError('Please answer all 22 health questionnaire questions before submitting for review.');
      setStep(3);
      return;
    }
    const saved = await save();
    const id = saved?.id ?? record?.id;
    if (!id) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const submitted = await submitClinicalRecord(id);
      setRecord(submitted);
      setMessage('Clinical form submitted. Hospital staff will make the final eligibility decision.');
    } catch (err: any) {
      setError(err?.response?.data?.error?.message ?? err?.response?.data?.message ?? 'Could not submit clinical form.');
    } finally { setSaving(false); }
  };

  const setValue = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));

  if (loading) return <section className="card">Loading clinical form...</section>;

  return (
    <section className="space-y-5">
      <div className="card border-red-100 bg-red-50/40">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">National Blood Service style workflow</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">Donor Clinical Record / Eligibility Form</h1>
        <p className="text-sm text-gray-600">Save a draft, submit for hospital review, then staff complete office-use screening.</p>
        <Workflow status={record?.status ?? 'DRAFT'} />
      </div>

      {message ? <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      {locked ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This record is submitted and locked. Amendments must be handled through review/version history.</p> : null}

      <div className="flex flex-wrap gap-2">
        {steps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} className={`rounded-full px-4 py-2 text-sm font-bold ${step === index ? 'bg-primary text-white' : 'border border-red-100 bg-white text-primary'}`}>{index + 1}. {label}</button>)}
      </div>

      <form className="card space-y-5" onSubmit={submit}>
        {step === 0 ? <div className="grid gap-3 md:grid-cols-2">
          <select className="legacy-input" disabled={locked} value={form.selectedHospitalId ?? ''} onChange={(e) => setValue('selectedHospitalId', e.target.value)} required><option value="">Select review hospital</option>{hospitals.map((h) => <option key={h.id} value={h.id}>{h.hospitalName} - {h.location}</option>)}</select>
          <input className="legacy-input" disabled={locked} type="date" value={String(form.formDate ?? '').slice(0,10)} onChange={(e) => setValue('formDate', e.target.value)} />
          <input className="legacy-input" disabled={locked} placeholder="Venue" value={form.venue ?? ''} onChange={(e) => setValue('venue', e.target.value)} />
          <select className="legacy-input" disabled={locked} value={form.title ?? ''} onChange={(e) => setValue('title', e.target.value)}><option value="">Title</option>{['Mr','Mrs','Ms','Dr','Prof','Other'].map((v) => <option key={v}>{v}</option>)}</select>
          {['firstName','lastName','callingName','areaOfResidence','addressOrWorkplace','occupation','idNumber','phoneNumber','email'].map((key) => <input key={key} className="legacy-input" disabled={locked} placeholder={key.replace(/([A-Z])/g, ' $1')} type={key === 'email' ? 'email' : 'text'} value={form[key] ?? ''} onChange={(e) => setValue(key, e.target.value)} required={['firstName','lastName','phoneNumber','email'].includes(key)} />)}
          <input className="legacy-input" disabled={locked} type="date" value={String(form.dateOfBirth ?? '').slice(0,10)} onChange={(e) => setValue('dateOfBirth', e.target.value)} required />
          <select className="legacy-input" disabled={locked} value={form.sex ?? ''} onChange={(e) => setValue('sex', e.target.value)} required><option value="">Sex</option><option>Male</option><option>Female</option></select>
          <select className="legacy-input" disabled={locked} value={form.idType ?? ''} onChange={(e) => setValue('idType', e.target.value)}><option value="">ID Type</option>{['Ghana Card/National ID','Passport','Driver’s License','Voter ID','NHIS Card','Student ID','Employment ID'].map((v) => <option key={v}>{v}</option>)}</select>
        </div> : null}

        {step === 1 ? <div className="grid gap-3 md:grid-cols-2">
          <select className="legacy-input" disabled={locked} value={form.hasDonatedBefore ? 'yes' : 'no'} onChange={(e) => setValue('hasDonatedBefore', e.target.value === 'yes')}><option value="no">No previous donation</option><option value="yes">Has donated before</option></select>
          <input className="legacy-input" disabled={locked} type="date" value={String(form.lastDonationDate ?? '').slice(0,10)} onChange={(e) => setValue('lastDonationDate', e.target.value)} />
          <input className="legacy-input" disabled={locked} type="number" min={0} placeholder="Voluntary donations" value={form.numberOfVoluntaryDonations ?? 0} onChange={(e) => setValue('numberOfVoluntaryDonations', Number(e.target.value))} />
          <input className="legacy-input" disabled={locked} type="number" min={0} placeholder="Replacement donations" value={form.numberOfReplacementDonations ?? 0} onChange={(e) => setValue('numberOfReplacementDonations', Number(e.target.value))} />
          <input className="legacy-input md:col-span-2" disabled={locked} placeholder="Donor card number" value={form.donorCardNumber ?? ''} onChange={(e) => setValue('donorCardNumber', e.target.value)} />
        </div> : null}

        {step === 2 ? <div className="space-y-3"><select className="legacy-input" disabled={locked} value={form.donorType ?? 'VOLUNTARY'} onChange={(e) => setValue('donorType', e.target.value)}><option value="VOLUNTARY">Voluntary donor</option><option value="REPLACEMENT_FAMILY">Replacement / family donor</option></select>{form.donorType === 'REPLACEMENT_FAMILY' ? <div className="grid gap-3 md:grid-cols-2">{['patientName','patientHospital','ward','relationshipToPatient','clerkingOfficerName','clerkingOfficerSignature'].map((key) => <input key={key} className="legacy-input" disabled={locked} placeholder={key.replace(/([A-Z])/g, ' $1')} value={form[key] ?? ''} onChange={(e) => setValue(key, e.target.value)} />)}</div> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-muted">Replacement/family details are hidden because this is a voluntary donor record.</p>}</div> : null}

        {step === 3 ? <div className="space-y-3">{questions.map((q) => <div key={q.questionKey} className="rounded-xl border border-gray-100 p-3"><p className="text-sm font-semibold text-navy">{q.questionKey}. {q.questionText}</p><div className="mt-2 flex gap-2"><button disabled={locked} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.questionKey]: { ...a[q.questionKey], answer: 'yes' } }))} className={`rounded-full px-4 py-1 text-sm font-bold ${answers[q.questionKey]?.answer === 'yes' ? 'bg-primary text-white' : 'bg-gray-100'}`}>Yes</button><button disabled={locked} type="button" onClick={() => setAnswers((a) => ({ ...a, [q.questionKey]: { ...a[q.questionKey], answer: 'no' } }))} className={`rounded-full px-4 py-1 text-sm font-bold ${answers[q.questionKey]?.answer === 'no' ? 'bg-green-600 text-white' : 'bg-gray-100'}`}>No</button></div>{answers[q.questionKey]?.answer === 'yes' ? <textarea disabled={locked} className="legacy-input mt-2" placeholder="Explain details for review staff" value={answers[q.questionKey]?.details ?? ''} onChange={(e) => setAnswers((a) => ({ ...a, [q.questionKey]: { ...a[q.questionKey], details: e.target.value } }))} /> : null}</div>)}</div> : null}

        {step === 4 ? <div className="space-y-3">{[
          ['declarationConfirmed','I confirm the information provided is true and correct.'],
          ['testingConsent','I understand my blood will be tested.'],
          ['contactConsent','I consent to being contacted where necessary.'],
          ['staffEligibilityConsent','I understand final eligibility is determined by hospital/blood donation staff.'],
          ['dataUseConsent','I consent to use of my donation information for safe blood service management.'],
        ].map(([key, label]) => <label key={key} className="flex gap-3 rounded-xl border border-gray-100 p-3 text-sm"><input disabled={locked} type="checkbox" checked={Boolean(form[key])} onChange={(e) => setValue(key, e.target.checked)} />{label}</label>)}<div className="grid gap-3 md:grid-cols-2"><input className="legacy-input" disabled={locked} placeholder="Donor signature placeholder" value={form.donorSignature ?? ''} onChange={(e) => setValue('donorSignature', e.target.value)} /><input className="legacy-input" disabled={locked} type="date" value={String(form.declarationDate ?? '').slice(0,10)} onChange={(e) => setValue('declarationDate', e.target.value)} /><input className="legacy-input" disabled={locked} placeholder="Counsellor name placeholder" value={form.counsellorName ?? ''} onChange={(e) => setValue('counsellorName', e.target.value)} /><input className="legacy-input" disabled={locked} placeholder="Counsellor signature placeholder" value={form.counsellorSignature ?? ''} onChange={(e) => setValue('counsellorSignature', e.target.value)} /></div></div> : null}

        <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-xl border border-gray-200 px-4 py-2 font-bold">Back</button>
          <button type="button" disabled={step === steps.length - 1} onClick={() => setStep((s) => Math.min(steps.length - 1, s + 1))} className="rounded-xl border border-gray-200 px-4 py-2 font-bold">Next</button>
          <button type="button" disabled={saving || locked} onClick={save} className="btn-secondary">{saving ? 'Saving...' : 'Save Draft'}</button>
          <button type="submit" disabled={saving || locked} className="btn-primary">Submit for Review</button>
          {record?.id ? <button type="button" className="rounded-xl border border-red-200 px-4 py-2 font-bold text-primary" onClick={() => downloadClinicalRecordExport(record.id)}>Export Record</button> : null}
        </div>
      </form>
    </section>
  );
}

function Workflow({ status }: { status: string }) {
  const stages = ['DRAFT', 'SUBMITTED', 'HOSPITAL_REVIEW', 'OFFICE_USE_COMPLETED', status.includes('DEFERRED') || status === 'REJECTED' ? status : 'APPROVED'];
  const current = Math.max(0, stages.indexOf(status));
  return <div className="mt-4 grid gap-2 md:grid-cols-5">{stages.map((stage, index) => <div key={`${stage}-${index}`} className={`rounded-xl border p-3 text-xs font-bold ${index <= current ? 'border-red-200 bg-white text-primary' : 'border-gray-100 bg-gray-50 text-gray-400'}`}>{stage.replace(/_/g, ' ')}</div>)}</div>;
}

