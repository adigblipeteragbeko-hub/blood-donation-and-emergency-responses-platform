import { FormEvent, useEffect, useMemo, useState } from 'react';
import api from '../services/api';
import {
  DonorClinicalRecord,
  HealthAnswer,
  HealthAnswerPayload,
  getMyClinicalRecords,
  saveClinicalDraft,
  submitClinicalRecord,
  downloadClinicalRecordExport,
} from '../services/donor-clinical-records';

const questions = [
  {
    questionText: 'Are you feeling healthy and well enough to donate blood today?',
    helperText: 'Only donate if you feel well today and have no signs of illness such as fever, cough, headache, or a cold.',
    section: 'Current Health',
  },
  {
    questionText: 'Have you ever been told by a healthcare professional or blood donation centre not to donate blood?',
    helperText: 'Include any previous temporary or permanent deferral from blood donation.',
    section: 'Previous Blood Donations',
  },
  {
    questionText: 'Are you currently taking any medication, treatment, or antibiotics?',
    helperText: 'Include prescription medicine, over-the-counter medicine, herbal treatment, injections, and antibiotics.',
    section: 'Short Health Pre-Screening',
  },
  {
    questionText: 'Have you ever been diagnosed with heart disease, cancer, epilepsy, tuberculosis, sickle cell disease, or another serious medical condition?',
    helperText: 'Tell the review team about any serious condition, even if it is controlled or happened in the past.',
    section: 'Short Health Pre-Screening',
    terms: ['Heart Disease', 'Cancer', 'Epilepsy', 'Tuberculosis'],
  },
  {
    questionText: 'In the recent policy period, have you had surgery, a blood transfusion, a tattoo, a piercing, or a needle-stick injury?',
    helperText: 'Include any recent operation, transfusion, accidental needle injury, tattoo, ear/body piercing, or similar skin-piercing procedure.',
    section: 'Short Health Pre-Screening',
  },
  {
    questionText: 'Have you ever had jaundice, hepatitis, HIV/AIDS, or another blood-borne or infectious disease?',
    helperText: 'Include liver infection, a positive hepatitis or HIV test, yellowing of the eyes or skin, or any infection passed through blood.',
    section: 'Short Health Pre-Screening',
    terms: ['Hepatitis'],
  },
  {
    questionText: 'Have you recently had symptoms or a diagnosis of a sexually transmitted infection, or another significant infection?',
    helperText: 'Include genital pain, urinary pain, unusual discharge, fever from infection, or any recent diagnosis that required treatment.',
    section: 'Short Health Pre-Screening',
  },
  {
    questionText: 'Have you received any vaccination recently?',
    helperText: 'Include COVID-19, Yellow Fever, Hepatitis, and any other recent vaccinations.',
    section: 'Short Health Pre-Screening',
    terms: ['Hepatitis'],
  },
  {
    questionText: 'If clinically applicable, are you pregnant, recently pregnant, or breastfeeding?',
    helperText: 'Select Not Applicable if this question does not apply to you. Include pregnancy, recent delivery, miscarriage, abortion, or current breastfeeding.',
    section: 'Short Health Pre-Screening',
    terms: ['Pregnancy'],
    allowNotApplicable: true,
  },
].map((question, index) => ({ questionKey: `q${index + 1}`, ...question }));

const healthQuestionSections = [
  'Current Health',
  'Short Health Pre-Screening',
];

const medicalTooltips: Record<string, string> = {
  Epilepsy: 'A condition that can cause repeated seizures or fits.',
  Tuberculosis: 'A bacterial infection, often affecting the lungs, that needs medical treatment.',
  Malaria: 'A mosquito-borne infection that can cause fever, chills, and body aches.',
  Hepatitis: 'Inflammation or infection of the liver, sometimes caused by a virus.',
  Cancer: 'A serious condition where abnormal cells grow and may spread in the body.',
  'Heart Disease': 'A medical condition affecting the heart or blood vessels.',
  Pregnancy: 'A period when someone is carrying a developing baby before birth.',
};

const steps = ['Personal', 'History', 'Replacement', 'Health', 'Declaration'];
type AnswerChoice = '' | 'yes' | 'no' | 'na';

const documentTypes = ['Ghana Card', 'Passport', "Driver's License", 'Voter ID', 'NHIS', 'Other'];
const patientRelationships = ['Parent', 'Child', 'Brother', 'Sister', 'Spouse', 'Relative', 'Friend', 'Other'];

const documentHelpers: Record<string, string> = {
  'Ghana Card': 'Use the Ghana Card format GHA-123456789-0. This checks format only, not NIA authenticity.',
  Passport: 'Enter letters and numbers exactly as shown on the passport. Spaces and symbols are not required.',
  "Driver's License": 'Enter letters and numbers from the licence number only.',
  'Voter ID': 'Enter letters and numbers from the voter ID card only.',
  NHIS: 'Enter letters and numbers from the NHIS card only.',
  Other: 'Enter the document number using letters, numbers, spaces, or hyphens only.',
};

const normalizeDocumentNumber = (idType: unknown, idNumber: unknown) => {
  const type = String(idType ?? '').trim();
  const raw = String(idNumber ?? '').trim();
  if (!raw) return raw;
  if (type === 'Ghana Card') return raw.toUpperCase();
  if (['Passport', "Driver's License", 'Voter ID', 'NHIS'].includes(type)) return raw.toUpperCase().replace(/\s+/g, '');
  return raw.replace(/\s+/g, ' ');
};

const validateDocumentNumber = (idType: unknown, idNumber: unknown) => {
  const type = String(idType ?? '').trim();
  const value = normalizeDocumentNumber(type, idNumber);
  if (!type || !value) return '';
  if (type === 'Ghana Card' && !/^GHA-[0-9]{9}-[0-9]$/.test(value)) {
    return 'Enter a valid Ghana Card format, for example GHA-123456789-0. This checks format only and does not verify authenticity.';
  }
  if (['Passport', "Driver's License", 'Voter ID', 'NHIS'].includes(type) && !/^[A-Z0-9-]{5,20}$/.test(value)) {
    return `${type} numbers should use 5 to 20 letters or numbers. Hyphens are allowed where printed on the document.`;
  }
  if (type === 'Other' && !/^[A-Za-z0-9 -]{3,30}$/.test(value)) {
    return 'Document numbers should use 3 to 30 letters, numbers, spaces, or hyphens.';
  }
  return '';
};

const emptyForm = {
  selectedHospitalId: '', formDate: '', venue: '', title: '', firstName: '', otherNames: '', lastName: '', dateOfBirth: '', sex: '', areaOfResidence: '', addressOrWorkplace: '', occupation: '', idType: '', idNumber: '', phoneNumber: '', email: '', preferredContactMethod: 'SMS', doNotContactForDonation: false,
  donorType: 'VOLUNTARY', hasDonatedBefore: false, lastDonationDate: '', numberOfVoluntaryDonations: 0, numberOfReplacementDonations: 0, donorCardNumber: '',
  patientName: '', patientHospital: '', requestReference: '', ward: '', relationshipToPatient: '',
  declarationConfirmed: false, testingConsent: false, contactConsent: false, staffEligibilityConsent: false, dataUseConsent: false, declarationDate: new Date().toISOString().slice(0, 10),
};

const optionalIsoDate = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const date = new Date(text);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
};

const friendlyClinicalError = (err: any, fallback: string) => {
  const raw = err?.response?.data?.error?.message ?? err?.response?.data?.message ?? err?.message;
  const message = Array.isArray(raw) ? raw.join(' ') : String(raw ?? '');

  if (Array.isArray(raw) || /healthAnswers\.\d+\.property|should not exist|property .* should not exist/i.test(message)) {
    if (import.meta.env.DEV) {
      console.warn('Clinical form validation details:', raw);
    }
    return 'We could not save the form because some submitted fields were invalid. Your answers have been preserved.';
  }
  if (message.includes('lastDonationDate') || message.toLowerCase().includes('last donation date')) {
    return 'Please provide your last donation date.';
  }
  if (message.includes('numberOfVoluntaryDonations') || message.toLowerCase().includes('total previous donations')) {
    return 'Please enter total previous donations.';
  }
  if (message.includes('formDate') || message.includes('valid ISO 8601 date string')) {
    return fallback;
  }
  return message || fallback;
};

const baseWorkflowStages = [
  { key: 'DRAFT', label: 'Draft' },
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'HOSPITAL_REVIEW', label: 'Hospital Review' },
  { key: 'OFFICE_USE_COMPLETED', label: 'Office Use Completed' },
  { key: 'APPROVED', label: 'Approved' },
];

const getWorkflowDisplay = (record: DonorClinicalRecord | null) => {
  const status = record?.status ?? 'DRAFT';
  const clinicalReview = record?.clinicalReview ?? {};
  const submitted = Boolean(record?.submittedAt || status !== 'DRAFT');
  const hospitalReviewed = Boolean(
    record?.hospitalReviewedAt ||
    record?.officeCompletedAt ||
    record?.finalDecisionAt ||
    clinicalReview.reviewedAt ||
    ['HOSPITAL_REVIEW', 'OFFICE_USE_COMPLETED', 'APPROVED', 'REJECTED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED'].includes(status),
  );
  const officeCompleted = Boolean(
    record?.officeCompletedAt ||
    record?.finalDecisionAt ||
    clinicalReview.reviewedAt ||
    ['OFFICE_USE_COMPLETED', 'APPROVED', 'REJECTED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED'].includes(status),
  );
  const approved = status === 'APPROVED' || clinicalReview.outcomeOfScreening === 'QUALIFIED';
  const rejected = status === 'REJECTED' || clinicalReview.outcomeOfScreening === 'REJECTED';
  const deferred = status === 'TEMPORARILY_DEFERRED' || status === 'PERMANENTLY_DEFERRED';
  const active = new Set<string>();

  if (!submitted) active.add('DRAFT');
  if (submitted) active.add('SUBMITTED');
  if (hospitalReviewed) active.add('HOSPITAL_REVIEW');
  if (officeCompleted) active.add('OFFICE_USE_COMPLETED');
  if (approved) active.add('APPROVED');
  if (rejected) active.add('REJECTED');
  if (deferred) active.add(status);

  const stages = [...baseWorkflowStages];
  if (rejected) stages.push({ key: 'REJECTED', label: 'Rejected' });
  if (deferred) {
    stages.push({
      key: status,
      label: status === 'TEMPORARILY_DEFERRED' ? 'Temporarily Deferred' : 'Permanently Deferred',
    });
  }

  const temporaryReasons = Array.isArray(clinicalReview.temporaryDeferralReasons)
    ? clinicalReview.temporaryDeferralReasons.filter(Boolean)
    : [];
  const permanentReasons = Array.isArray(clinicalReview.permanentDeferralReasons)
    ? clinicalReview.permanentDeferralReasons.filter(Boolean)
    : [];
  const deferralDetails = [
    ...temporaryReasons,
    ...permanentReasons,
    clinicalReview.temporaryDeferralDuration ? `Duration: ${clinicalReview.temporaryDeferralDuration}` : '',
  ].filter(Boolean);

  let message = 'Your health form is saved as draft.';
  if (approved) {
    message = 'Your health form has been approved. Your donor eligibility is complete.';
  } else if (rejected) {
    message = 'Your health form was rejected. Please contact the review hospital for details.';
  } else if (deferred) {
    message = status === 'TEMPORARILY_DEFERRED'
      ? 'Your health form was temporarily deferred. Please follow the hospital guidance before donating.'
      : 'Your health form was permanently deferred. Please contact the review hospital for details.';
  } else if (officeCompleted) {
    message = 'Hospital office-use screening has been completed.';
  } else if (hospitalReviewed) {
    message = 'Your health form is under hospital review.';
  } else if (submitted) {
    message = 'Your health form has been submitted and is awaiting hospital review.';
  }

  return { active, deferralDetails, message, stages, status };
};

export default function DonorClinicalFormPage() {
  const [step, setStep] = useState(0);
  const [record, setRecord] = useState<DonorClinicalRecord | null>(null);
  const [canStartNewAssessment, setCanStartNewAssessment] = useState(false);
  const [form, setForm] = useState<any>(emptyForm);
  const [answers, setAnswers] = useState<Record<string, { answer: AnswerChoice; details: string }>>(
    Object.fromEntries(questions.map((q) => [q.questionKey, { answer: '', details: '' }])),
  );
  const [hospitals, setHospitals] = useState<Array<{ id: string; hospitalName: string; location: string; address?: string; city?: string | null; region?: string | null }>>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [feelingWellDetailsAttempted, setFeelingWellDetailsAttempted] = useState(false);
  const [requestValidation, setRequestValidation] = useState<{
    state: 'idle' | 'loading' | 'valid' | 'invalid';
    message: string;
  }>({ state: 'idle', message: '' });

  const locked = record ? record.status !== 'DRAFT' && !canStartNewAssessment : false;
  const workflowDisplay = useMemo(() => getWorkflowDisplay(record), [record]);

  useEffect(() => {
    void (async () => {
      try {
        const [mine, hospitalResponse] = await Promise.all([getMyClinicalRecords(), api.get('/donors/hospital-options')]);
        const latest = mine.latest;
        const nextEligibilityDate = mine.donorProfile?.nextEligibilityDate ? new Date(mine.donorProfile.nextEligibilityDate) : null;
        const deferralWindowEnded =
          latest?.status === 'TEMPORARILY_DEFERRED' &&
          nextEligibilityDate &&
          !Number.isNaN(nextEligibilityDate.getTime()) &&
          nextEligibilityDate <= new Date();
        setCanStartNewAssessment(Boolean(deferralWindowEnded));
        setRecord(deferralWindowEnded ? null : latest);
        if (latest) {
          setForm((prev: any) => ({
            ...prev,
            ...Object.fromEntries(Object.entries(latest).filter(([, v]) => v !== null && typeof v !== 'object')),
            firstName: latest.firstName ?? latest.donor?.firstName ?? prev.firstName,
            otherNames: latest.otherNames ?? latest.donor?.otherNames ?? prev.otherNames,
            lastName: latest.lastName ?? latest.donor?.surname ?? prev.lastName,
          }));
          if (latest.selectedHospitalId) setForm((prev: any) => ({ ...prev, selectedHospitalId: latest.selectedHospitalId }));
          if (latest.healthAnswers?.length) {
            setAnswers(Object.fromEntries(questions.map((q) => {
              const found = latest.healthAnswers?.find((a) => a.questionKey === q.questionKey);
              const foundDetails = found?.details ?? '';
              const nextAnswer = found
                ? q.allowNotApplicable && foundDetails === 'Not Applicable'
                  ? 'na'
                  : found.answer
                    ? 'yes'
                    : 'no'
                : '';
              return [q.questionKey, { answer: nextAnswer, details: foundDetails === 'Not Applicable' ? '' : foundDetails }];
            })));
          }
        } else if (mine.donorProfile) {
          setForm((prev: any) => ({
            ...prev,
            firstName: mine.donorProfile?.firstName ?? prev.firstName,
            otherNames: mine.donorProfile?.otherNames ?? prev.otherNames,
            lastName: mine.donorProfile?.surname ?? prev.lastName,
            email: mine.donorProfile?.email ?? prev.email,
            phoneNumber: mine.donorProfile?.phone ?? prev.phoneNumber,
          }));
        }
        setHospitals(hospitalResponse.data?.data ?? hospitalResponse.data ?? []);
      } catch {
        setError('Could not load clinical record workspace.');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (form.donorType !== 'REPLACEMENT_FAMILY') {
      setRequestValidation({ state: 'idle', message: '' });
      return;
    }

    const reference = String(form.requestReference ?? '').trim().toUpperCase();
    if (!reference) {
      setRequestValidation({ state: 'idle', message: 'Enter a BDR request reference to link this replacement donor.' });
      return;
    }

    if (!/^BDR-\d{4}-\d{5}$/.test(reference)) {
      setRequestValidation({ state: 'invalid', message: 'Use the format BDR-2026-00001.' });
      return;
    }

    let cancelled = false;
    setRequestValidation({ state: 'loading', message: 'Checking request reference...' });
    const timer = window.setTimeout(async () => {
      try {
        const response = await api.get(`/blood-requests/reference/${encodeURIComponent(reference)}/validate`);
        const result = response.data?.data ?? response.data;
        if (cancelled) return;
        if (result?.valid) {
          setRequestValidation({ state: 'valid', message: 'Request reference found.' });
          if (result.hospitalName) {
            setForm((prev: any) => ({
              ...prev,
              requestReference: result.requestReference ?? reference,
              patientHospital: result.hospitalName,
            }));
          }
        } else {
          setRequestValidation({ state: 'invalid', message: 'No blood request found with this reference.' });
        }
      } catch {
        if (!cancelled) {
          setRequestValidation({ state: 'invalid', message: 'Could not validate this request reference right now.' });
        }
      }
    }, 500);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [form.donorType, form.requestReference]);

  const healthAnswers: HealthAnswer[] = useMemo(() => questions
    .filter((q) => answers[q.questionKey]?.answer)
    .map((q) => ({
      questionKey: q.questionKey,
      questionText: q.questionText,
      answer: answers[q.questionKey]?.answer === 'yes',
      details: answers[q.questionKey]?.answer === 'na' ? 'Not Applicable' : answers[q.questionKey]?.details,
    })), [answers]);

  const buildHealthAnswersPayload = (): HealthAnswerPayload[] => healthAnswers.map((answer) => ({
    questionKey: answer.questionKey,
    questionText: answer.questionText,
    answer: answer.answer,
    ...(answer.details?.trim() ? { details: answer.details.trim() } : {}),
  }));
  const feelingWellAnswer = answers.q1;
  const feelingWellNeedsDetails = feelingWellAnswer?.answer === 'no' && !feelingWellAnswer.details.trim();

  const save = async () => {
    setSaving(true); setError(''); setMessage('');
    try {
      const isReplacement = form.donorType === 'REPLACEMENT_FAMILY';
      const hasDonatedBefore = Boolean(form.hasDonatedBefore);
      const previousDonationCount = hasDonatedBefore ? Number(form.numberOfVoluntaryDonations ?? 0) : 0;
      const normalizedLastDonationDate = optionalIsoDate(form.lastDonationDate);
      const normalizedIdNumber = normalizeDocumentNumber(form.idType, form.idNumber);
      const documentError = validateDocumentNumber(form.idType, normalizedIdNumber);

      if (documentError) {
        setError(documentError);
        setStep(0);
        return null;
      }
      if (hasDonatedBefore && !normalizedLastDonationDate) {
        setError('Please provide your last donation date.');
        return null;
      }

      const { donorSignature: _donorSignature, ...formWithoutSignature } = form;
      const payload = {
        ...formWithoutSignature,
        formDate: optionalIsoDate(form.formDate) ?? new Date().toISOString(),
        dateOfBirth: optionalIsoDate(form.dateOfBirth) ?? form.dateOfBirth,
        venue: form.venue || venueForHospital(selectedHospital),
        idNumber: normalizedIdNumber,
        patientName: isReplacement ? form.patientName : '',
        patientHospital: isReplacement ? form.patientHospital || selectedHospital?.hospitalName || '' : '',
        requestReference: isReplacement ? String(form.requestReference ?? '').toUpperCase().trim() : '',
        relationshipToPatient: isReplacement ? form.relationshipToPatient : '',
        hasDonatedBefore,
        lastDonationDate: hasDonatedBefore ? normalizedLastDonationDate : null,
        numberOfVoluntaryDonations: previousDonationCount,
        numberOfReplacementDonations: 0,
        donorCardNumber: hasDonatedBefore ? form.donorCardNumber : '',
        declarationDate: optionalIsoDate(form.declarationDate) ?? new Date().toISOString(),
        healthAnswers: buildHealthAnswersPayload(),
      };
      const saved = await saveClinicalDraft(payload, canStartNewAssessment ? undefined : record?.id);
      setRecord(saved);
      setCanStartNewAssessment(false);
      setMessage('Draft saved successfully.');
      return saved;
    } catch (err: any) {
      setError(friendlyClinicalError(err, 'Unable to save draft. Please check the required fields.'));
      return null;
    } finally { setSaving(false); }
  };

  const validateFeelingWellDetails = () => {
    if (!feelingWellNeedsDetails) return true;
    setFeelingWellDetailsAttempted(true);
    setStep(3);
    return false;
  };

  const goNext = () => {
    if (step === 3 && !validateFeelingWellDetails()) return;
    setStep((s) => Math.min(steps.length - 1, s + 1));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (form.donorType === 'REPLACEMENT_FAMILY' && requestValidation.state !== 'valid') {
      setError(requestValidation.message || 'Validate the BDR request reference before submitting.');
      setStep(2);
      return;
    }
    if (healthAnswers.length < questions.length) {
      setError('Please answer all eligibility screening questions before submitting for review.');
      setStep(3);
      return;
    }
    if (!validateFeelingWellDetails()) return;
    const saved = await save();
    const id = saved?.id ?? record?.id;
    if (!id) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const submitted = await submitClinicalRecord(id);
      setRecord(submitted);
      setMessage('Clinical record submitted successfully. Hospital staff will make the final eligibility decision.');
    } catch (err: any) {
      setError(friendlyClinicalError(err, 'Unable to submit form. Please check the required fields.'));
    } finally { setSaving(false); }
  };

  const setValue = (key: string, value: unknown) => setForm((prev: any) => ({ ...prev, [key]: value }));
  const selectedHospital = hospitals.find((hospital) => hospital.id === form.selectedHospitalId);
  const venueForHospital = (hospital?: { location?: string; address?: string; city?: string | null; region?: string | null }) =>
    [hospital?.address, hospital?.location, hospital?.city, hospital?.region].filter(Boolean).join(', ');
  const requiredFromLogin = new URLSearchParams(window.location.search).get('required') === '1';

  if (loading) {
    return (
      <section className="card space-y-4" aria-busy="true" aria-live="polite">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-primary">Donor health eligibility</p>
          <h1 className="mt-1 text-xl font-bold text-primary">Loading your health eligibility form</h1>
          <p className="mt-1 text-sm text-gray-600">Preparing your saved answers, hospital options, and review status.</p>
        </div>
        <div className="space-y-3" aria-hidden="true">
          <div className="h-4 w-2/3 animate-pulse rounded bg-gray-200" />
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
          <div className="h-24 animate-pulse rounded-xl bg-gray-100" />
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-5">
      <div className="card border-red-100 bg-red-50/40">
        <p className="text-xs font-bold uppercase tracking-wide text-primary">National Blood Service style workflow</p>
        <h1 className="mt-1 text-2xl font-bold text-primary">Donor Clinical Record / Eligibility Form</h1>
        <p className="text-sm text-gray-600">Save a draft, submit for hospital review, then staff complete office-use screening.</p>
        <Workflow display={workflowDisplay} />
      </div>

      {(requiredFromLogin || !record || canStartNewAssessment) && !locked ? (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-800">
          <p className="font-black">Complete Your Eligibility Form</p>
          <p className="mt-1">Before you can participate in blood donation activities, please complete this short eligibility form.</p>
        </div>
      ) : null}

      {message ? <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">{message}</p> : null}
      {error ? <p className="rounded-xl bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</p> : null}
      <div className="rounded-xl border border-red-100 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Current workflow status</p>
        <p className="mt-2 text-sm font-semibold text-navy">{workflowDisplay.message}</p>
        {workflowDisplay.deferralDetails.length ? (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-amber-800">
            {workflowDisplay.deferralDetails.map((detail) => <li key={detail}>{detail}</li>)}
          </ul>
        ) : null}
      </div>
      {locked ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">This record is locked. Amendments must be handled through review/version history.</p> : null}

      <div className="flex flex-wrap gap-2">
        {steps.map((label, index) => <button key={label} type="button" onClick={() => setStep(index)} className={`rounded-full px-4 py-2 text-sm font-bold ${step === index ? 'bg-primary text-white' : 'border border-red-100 bg-white text-primary'}`}>{index + 1}. {label}</button>)}
      </div>

      <form className="card space-y-5" onSubmit={submit}>
        {step === 0 ? <div className="grid gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <select
              className="legacy-input"
              disabled={locked}
              value={form.selectedHospitalId ?? ''}
              onChange={(e) => {
                const hospital = hospitals.find((item) => item.id === e.target.value);
                setForm((prev: any) => ({ ...prev, selectedHospitalId: e.target.value, venue: venueForHospital(hospital) }));
                if (hospital) setMessage('Review hospital selected successfully.');
              }}
              required
            >
              <option value="">Select review hospital</option>
              {hospitals.map((h) => <option key={h.id} value={h.id}>{h.hospitalName} - {h.location}</option>)}
            </select>
          </div>
          <input className="legacy-input" disabled={locked} placeholder="First Name *" value={form.firstName ?? ''} onChange={(e) => setValue('firstName', e.target.value)} required />
          <input className="legacy-input" disabled={locked} placeholder="Other Name(s)" value={form.otherNames ?? ''} onChange={(e) => setValue('otherNames', e.target.value)} />
          <input className="legacy-input" disabled={locked} placeholder="Surname *" value={form.lastName ?? ''} onChange={(e) => setValue('lastName', e.target.value)} required />
          <input className="legacy-input" disabled={locked} placeholder="Area / Community of Residence *" value={form.areaOfResidence ?? ''} onChange={(e) => setValue('areaOfResidence', e.target.value)} required />
          <label className="space-y-1">
            <span className="text-sm font-bold text-navy">Document Type *</span>
            <select
              className="legacy-input"
              disabled={locked}
              value={form.idType ?? ''}
              onChange={(e) => {
                const nextType = e.target.value;
                setForm((prev: any) => ({ ...prev, idType: nextType, idNumber: normalizeDocumentNumber(nextType, prev.idNumber) }));
              }}
              required
            >
              <option value="">Document Type *</option>
              {documentTypes.map((v) => <option key={v}>{v}</option>)}
            </select>
          </label>
          <label className="space-y-1">
            <span className="text-sm font-bold text-navy">Document Number *</span>
            <input
              aria-describedby="document-number-help"
              aria-invalid={Boolean(validateDocumentNumber(form.idType, form.idNumber))}
              className="legacy-input"
              disabled={locked}
              placeholder={form.idType === 'Ghana Card' ? 'GHA-123456789-0' : 'Document Number *'}
              value={form.idNumber ?? ''}
              onBlur={() => setValue('idNumber', normalizeDocumentNumber(form.idType, form.idNumber))}
              onChange={(e) => setValue('idNumber', e.target.value)}
              required
            />
            <p id="document-number-help" className={`text-xs font-semibold ${validateDocumentNumber(form.idType, form.idNumber) ? 'text-red-700' : 'text-muted'}`}>
              {validateDocumentNumber(form.idType, form.idNumber) || documentHelpers[form.idType] || 'Select a document type to see the expected number format.'}
            </p>
          </label>
          <input className="legacy-input" disabled={locked} placeholder="Primary Phone Number *" value={form.phoneNumber ?? ''} onChange={(e) => setValue('phoneNumber', e.target.value)} required />
          <label className="space-y-1">
            <span className="text-sm font-bold text-navy">Date of Birth *</span>
            <input className="legacy-input" disabled={locked} type="date" value={String(form.dateOfBirth ?? '').slice(0,10)} onChange={(e) => setValue('dateOfBirth', e.target.value)} required />
          </label>
          <select className="legacy-input" disabled={locked} value={form.sex ?? ''} onChange={(e) => setValue('sex', e.target.value)} required><option value="">Sex</option><option>Male</option><option>Female</option></select>
        </div> : null}

        {step === 1 ? <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-1 md:col-span-2">
            <span className="text-sm font-bold text-navy">Previous Donation Status *</span>
            <select className="legacy-input" disabled={locked} value={form.hasDonatedBefore ? 'yes' : 'no'} onChange={(e) => {
              const donated = e.target.value === 'yes';
              setForm((prev: any) => ({ ...prev, hasDonatedBefore: donated, lastDonationDate: donated ? prev.lastDonationDate : '', numberOfVoluntaryDonations: donated ? prev.numberOfVoluntaryDonations : 0, numberOfReplacementDonations: 0 }));
            }}><option value="no">No Previous Donation</option><option value="yes">Donated Before</option></select>
          </label>
          {form.hasDonatedBefore ? <>
            <label className="space-y-1">
              <span className="text-sm font-bold text-navy">Date of Last Donation *</span>
              <input className="legacy-input" disabled={locked} required type="date" value={String(form.lastDonationDate ?? '').slice(0,10)} onChange={(e) => setValue('lastDonationDate', e.target.value)} />
            </label>
          </> : null}
          <div className="md:col-span-2">
            <HealthQuestion
              question={questions[1]}
              answer={answers.q2}
              locked={locked}
              showFeelingWellDetailsError={false}
              onAnswer={(answer) => setAnswers((a) => ({ ...a, q2: { ...a.q2, answer } }))}
              onDetails={(details) => setAnswers((a) => ({ ...a, q2: { ...a.q2, details } }))}
            />
          </div>
        </div> : null}

        {step === 2 ? <div className="space-y-3"><select className="legacy-input" disabled={locked} value={form.donorType ?? 'VOLUNTARY'} onChange={(e) => setValue('donorType', e.target.value)}><option value="VOLUNTARY">Voluntary Donor</option><option value="REPLACEMENT_FAMILY">Replacement / Family Donor</option></select>{form.donorType === 'REPLACEMENT_FAMILY' ? <div className="grid gap-3 md:grid-cols-2">
          <input className="legacy-input" disabled={locked} required placeholder="Patient Name *" value={form.patientName ?? ''} onChange={(e) => setValue('patientName', e.target.value)} />
          <div className="space-y-1">
            <input className="legacy-input" disabled={locked} required placeholder="Request Reference (BDR-2026-00001) *" value={form.requestReference ?? ''} onChange={(e) => setValue('requestReference', e.target.value.toUpperCase())} />
            <p className={`text-xs font-semibold ${requestValidation.state === 'valid' ? 'text-green-700' : requestValidation.state === 'invalid' ? 'text-red-700' : 'text-muted'}`}>{requestValidation.message || 'Enter the blood request reference for validation.'}</p>
          </div>
          {form.patientHospital || selectedHospital?.hospitalName ? <p className="rounded-xl bg-green-50 p-3 text-sm font-semibold text-green-700">Linked hospital: {form.patientHospital || selectedHospital?.hospitalName}</p> : null}
          <select className="legacy-input" disabled={locked} required value={form.relationshipToPatient ?? ''} onChange={(e) => setValue('relationshipToPatient', e.target.value)}><option value="">Relationship to Patient *</option>{patientRelationships.map((item) => <option key={item}>{item}</option>)}</select>
          <p className="rounded-xl bg-blue-50 p-3 text-sm font-semibold text-blue-700 md:col-span-2">The request reference is checked before submission.</p>
        </div> : <p className="rounded-xl bg-gray-50 p-4 text-sm text-muted">Replacement/family details are hidden because this is a voluntary donor record.</p>}</div> : null}

        {step === 3 ? (
          <div className="space-y-5">
            <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4 text-sm text-blue-900">
              <p className="font-bold">Health questionnaire</p>
              <p className="mt-1">Please answer every question honestly. Your answers help hospital staff review your donation safety.</p>
            </div>
            {healthQuestionSections.map((section) => {
              const sectionQuestions = questions.filter((question) => question.section === section);
              if (!sectionQuestions.length) return null;
              return (
                <fieldset key={section} className="space-y-3 rounded-2xl border border-gray-100 p-4">
                  <legend className="px-1 text-base font-black text-navy">{section}</legend>
                  {sectionQuestions.map((q) => (
                    <HealthQuestion
                      key={q.questionKey}
                      question={q}
                      answer={answers[q.questionKey]}
                      locked={locked}
                      showFeelingWellDetailsError={q.questionKey === 'q1' && feelingWellDetailsAttempted && feelingWellNeedsDetails}
                      onAnswer={(answer) => {
                        if (q.questionKey === 'q1' && answer !== 'no') setFeelingWellDetailsAttempted(false);
                        setAnswers((a) => ({ ...a, [q.questionKey]: { ...a[q.questionKey], answer, details: answer === 'na' ? '' : a[q.questionKey].details } }));
                      }}
                      onDetails={(details) => {
                        if (q.questionKey === 'q1' && details.trim()) setFeelingWellDetailsAttempted(false);
                        setAnswers((a) => ({ ...a, [q.questionKey]: { ...a[q.questionKey], details } }));
                      }}
                    />
                  ))}
                </fieldset>
              );
            })}
          </div>
        ) : null}

        {step === 4 ? <div className="space-y-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-wide text-primary">Declaration</p>
            <h2 className="text-xl font-bold text-navy">Electronic Consent</h2>
            <p className="mt-1 text-sm text-muted">Your authenticated submission records your consent, account, donor reference, and submission time.</p>
          </div>
          {[
          ['declarationConfirmed','I confirm that the information I have provided is true and accurate.'],
          ['testingConsent','I understand that my blood may be tested for transfusion safety purposes.'],
          ['contactConsent','I consent to eligibility screening and blood donation procedures.'],
          ['staffEligibilityConsent','I understand that hospital staff will review my submission before approval.'],
        ].map(([key, label]) => <label key={key} className="flex gap-3 rounded-xl border border-gray-100 p-3 text-sm"><input disabled={locked} type="checkbox" required checked={Boolean(form[key])} onChange={(e) => setValue(key, e.target.checked)} />{label}</label>)}</div> : null}

        <div className="flex flex-wrap gap-3 border-t border-gray-100 pt-4">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))} className="rounded-xl border border-gray-200 px-4 py-2 font-bold">Back</button>
          <button type="button" disabled={step === steps.length - 1} onClick={goNext} className="rounded-xl border border-gray-200 px-4 py-2 font-bold">Next</button>
          <button type="button" disabled={saving || locked} onClick={save} className="btn-secondary">{saving ? 'Saving...' : 'Save Draft'}</button>
          <button type="submit" disabled={saving || locked} className="btn-primary">Submit for Review</button>
          {record?.id ? <button type="button" className="rounded-xl border border-red-200 px-4 py-2 font-bold text-primary" onClick={() => downloadClinicalRecordExport(record.id)}>Export Record</button> : null}
        </div>
      </form>
    </section>
  );
}

function Workflow({ display }: { display: ReturnType<typeof getWorkflowDisplay> }) {
  return (
    <div className="mt-4 grid gap-2 md:grid-cols-5">
      {display.stages.map((stage) => {
        const isActive = display.active.has(stage.key);
        const isApproved = stage.key === 'APPROVED';
        const isRejected = stage.key === 'REJECTED';
        const isDeferred = stage.key.includes('DEFERRED');
        return (
          <div
            key={stage.key}
            className={`rounded-xl border p-3 text-xs font-bold transition ${
              isActive
                ? isApproved
                  ? 'border-green-200 bg-green-50 text-green-700 shadow-sm'
                  : isRejected
                    ? 'border-red-200 bg-red-50 text-red-700 shadow-sm'
                    : isDeferred
                      ? 'border-amber-200 bg-amber-50 text-amber-700 shadow-sm'
                  : 'border-red-200 bg-primary text-white shadow-sm'
                : 'border-gray-100 bg-gray-50 text-gray-400'
            }`}
          >
            {stage.label}
          </div>
        );
      })}
    </div>
  );
}

type HealthQuestionItem = typeof questions[number];

function HealthQuestion({
  question,
  answer,
  locked,
  showFeelingWellDetailsError,
  onAnswer,
  onDetails,
}: {
  question: HealthQuestionItem;
  answer?: { answer: AnswerChoice; details: string };
  locked: boolean;
  showFeelingWellDetailsError?: boolean;
  onAnswer: (answer: AnswerChoice) => void;
  onDetails: (details: string) => void;
}) {
  const labelId = `${question.questionKey}-label`;
  const helperId = `${question.questionKey}-helper`;
  const detailsId = `${question.questionKey}-details`;
  const detailsErrorId = `${question.questionKey}-details-error`;
  const displayNumber = question.questionKey.replace('q', 'Question ');
  const isFeelingWellQuestion = question.questionKey === 'q1';
  const isPreviousDeferralQuestion = question.questionKey === 'q2';
  const selectedAnswer = answer?.answer;
  const riskAnswerSelected = isFeelingWellQuestion ? selectedAnswer === 'no' : selectedAnswer === 'yes';
  const showDetails = riskAnswerSelected;
  const detailsRequired = isFeelingWellQuestion && selectedAnswer === 'no';
  const yesSelectedClass = isFeelingWellQuestion ? 'border-green-600 bg-green-600 text-white ring-2 ring-green-600 ring-offset-1' : 'border-red-600 bg-red-600 text-white ring-2 ring-red-600 ring-offset-1';
  const noSelectedClass = isFeelingWellQuestion ? 'border-red-600 bg-red-600 text-white ring-2 ring-red-600 ring-offset-1' : 'border-green-600 bg-green-600 text-white ring-2 ring-green-600 ring-offset-1';
  const inactiveClass = 'border-transparent bg-gray-100 text-slate-800';
  const yesButtonClass = `min-h-11 rounded-full border px-5 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 ${isFeelingWellQuestion ? 'focus:ring-green-600' : 'focus:ring-red-600'} ${selectedAnswer === 'yes' ? yesSelectedClass : inactiveClass}`;
  const noButtonClass = `min-h-11 rounded-full border px-5 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-offset-2 ${isFeelingWellQuestion ? 'focus:ring-red-600' : 'focus:ring-green-600'} ${selectedAnswer === 'no' ? noSelectedClass : inactiveClass}`;
  const naButtonClass = `min-h-11 rounded-full border px-5 py-2 text-sm font-bold focus:outline-none focus:ring-2 focus:ring-slate-500 focus:ring-offset-2 ${selectedAnswer === 'na' ? 'border-slate-500 bg-slate-600 text-white ring-2 ring-slate-500 ring-offset-1' : inactiveClass}`;
  const detailsClass = `legacy-input mt-1 min-h-24 ${riskAnswerSelected ? 'border-red-300 bg-red-50/40 focus:border-red-600 focus:ring-red-100' : 'border-green-300 focus:border-green-600 focus:ring-green-100'}`;
  const detailsPlaceholder = isFeelingWellQuestion && selectedAnswer === 'no'
    ? 'Please explain why you are not feeling well enough to donate today.'
    : isPreviousDeferralQuestion
      ? 'Share what the healthcare professional or donation centre told you, if you remember.'
      : 'Add any dates, treatment, symptoms, or details you remember.';

  return (
    <fieldset
      className="rounded-xl border border-gray-100 bg-white p-4 focus-within:border-primary focus-within:ring-2 focus-within:ring-red-100"
      aria-describedby={helperId}
    >
      <legend id={labelId} className="w-full">
        <span className="block text-xs font-black uppercase tracking-[0.16em] text-slate-500">{displayNumber}</span>
        <span className="mt-1 flex flex-wrap items-center gap-1 text-sm font-bold leading-6 text-navy">
          {question.questionText}
          {question.terms?.map((term) => <InfoTooltip key={term} term={term} />)}
        </span>
      </legend>
      <p id={helperId} className="mt-2 text-sm leading-6 text-slate-600">{question.helperText}</p>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-labelledby={labelId}>
        <button
          disabled={locked}
          type="button"
          onClick={() => onAnswer('yes')}
          aria-pressed={answer?.answer === 'yes'}
          className={yesButtonClass}
        >
          Yes
        </button>
        <button
          disabled={locked}
          type="button"
          onClick={() => onAnswer('no')}
          aria-pressed={answer?.answer === 'no'}
          className={noButtonClass}
        >
          No
        </button>
        {question.allowNotApplicable ? (
          <button
            disabled={locked}
            type="button"
            onClick={() => onAnswer('na')}
            aria-pressed={answer?.answer === 'na'}
            className={naButtonClass}
          >
            Not Applicable
          </button>
        ) : null}
      </div>
      {showDetails ? (
        <label className="mt-3 block" htmlFor={detailsId}>
          <span className="text-sm font-bold text-navy">Details for review staff</span>
          <textarea
            id={detailsId}
            disabled={locked}
            required={detailsRequired}
            aria-invalid={showFeelingWellDetailsError ? 'true' : undefined}
            aria-describedby={showFeelingWellDetailsError ? detailsErrorId : undefined}
            className={detailsClass}
            placeholder={detailsPlaceholder}
            value={answer?.details ?? ''}
            onChange={(event) => onDetails(event.target.value)}
          />
          {showFeelingWellDetailsError ? (
            <span id={detailsErrorId} className="mt-1 block text-sm font-semibold text-red-700">
              Please provide an explanation before continuing.
            </span>
          ) : null}
        </label>
      ) : null}
    </fieldset>
  );
}

function InfoTooltip({ term }: { term: string }) {
  const description = medicalTooltips[term];
  if (!description) return null;
  return (
    <span className="group relative inline-flex align-middle">
      <button
        type="button"
        className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-blue-200 bg-blue-50 text-xs font-black text-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
        aria-label={`${term}: ${description}`}
      >
        i
      </button>
      <span
        role="tooltip"
        className="pointer-events-none absolute left-1/2 top-7 z-10 hidden w-64 -translate-x-1/2 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold leading-5 text-white shadow-lg group-focus-within:block group-hover:block"
      >
        <span className="block font-black">{term}</span>
        {description}
      </span>
    </span>
  );
}

