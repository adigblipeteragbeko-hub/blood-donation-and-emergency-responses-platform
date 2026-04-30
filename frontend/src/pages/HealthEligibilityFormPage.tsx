import { FormEvent, useEffect, useState } from 'react';
import api from '../services/api';

type YesNo = '' | 'Yes' | 'No';

const questionItems = [
  { key: 'q1', label: '1. Are you feeling well today (no fever, cough, headache, or cold)?' },
  { key: 'q2', label: '2. Have you ever been deferred as a donor or told not to donate blood?' },
  { key: 'q3', label: '3. Are you taking medication?' },
  { key: 'q4', label: '4. Have you had epilepsy, stomach ulcer, heart disease, or cancer?' },
  { key: 'q5', label: '5. Have you had tuberculosis?' },
  { key: 'q6', label: '6. Have you been vaccinated in the last 4 weeks?' },
  { key: 'q7', label: '7. Have you had jaundice, liver disease, or positive hepatitis test?' },
  { key: 'q8', label: '8. Do you have sickle cell disease / trait or recurrent joint pains?' },
  { key: 'q9', label: '9. Have you injected yourself with drugs or non-prescribed medication?' },
  { key: 'q10', label: '10. In last 6 months: needle-stick injury or non-hospital injection/scarification?' },
  { key: 'q11', label: '11. Have you ever had a headache?' },
  { key: 'q12', label: '12. Have you had dental treatment in last 1 week, or antibiotics now?' },
  { key: 'q13', label: '13. In last 6 months, have you had surgery with general anesthesia?' },
  { key: 'q14', label: '14. In last 6 months, have you received blood/component transfusion?' },
  { key: 'q15', label: '15. In last 6 months, lost more than 5kg unintentionally?' },
  { key: 'q16', label: '16. In last 6 months, unprotected sex with more than one partner?' },
  { key: 'q17', label: '17. Have you ever had gonorrhea, genital, or urinary pain/discharge?' },
  { key: 'q18', label: '18. (For men only) In last 6 months, have you had sex with a man?' },
  { key: 'q19', label: '19. Have you or your partner tested positive for HIV (AIDS)?' },
  { key: 'q20', label: '20. After donation, will you do vigorous/hazardous activity today?' },
  { key: 'q21', label: '21. Are you donating because you were told to donate for someone?' },
  { key: 'q22', label: '22. Have you been pregnant in last 12 months / currently breastfeeding?' },
] as const;

export default function HealthEligibilityFormPage() {
  const [saving, setSaving] = useState(false);
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);
  const [healthFormCompleted, setHealthFormCompleted] = useState(false);
  const [adminApproved, setAdminApproved] = useState(false);
  const [submittedAt, setSubmittedAt] = useState<string | null>(null);
  const [hospitals, setHospitals] = useState<Array<{ id: string; hospitalName: string; location: string; registrationCode: string }>>([]);

  const [form, setForm] = useState({
    date: '',
    venue: '',
    title: '',
    firstName: '',
    lastName: '',
    callingName: '',
    dateOfBirth: '',
    sex: '',
    areaOfResidence: '',
    workplaceAddress: '',
    occupation: '',
    idType: '',
    idNumber: '',
    phoneNumber: '',
    email: '',
    preferredContactMethod: '',
    haveDonatedBefore: '' as YesNo,
    lastDonationDate: '',
    voluntaryTimes: '',
    replacementTimes: '',
    donorCardNumber: '',
    selectedHospitalId: '',
    patientName: '',
    hospital: '',
    ward: '',
    relationshipToPatient: '',
    referralReason: '',
    q1: '' as YesNo,
    q2: '' as YesNo,
    q3: '' as YesNo,
    q4: '' as YesNo,
    q5: '' as YesNo,
    q6: '' as YesNo,
    q7: '' as YesNo,
    q8: '' as YesNo,
    q9: '' as YesNo,
    q10: '' as YesNo,
    q11: '' as YesNo,
    q12: '' as YesNo,
    q13: '' as YesNo,
    q14: '' as YesNo,
    q15: '' as YesNo,
    q16: '' as YesNo,
    q17: '' as YesNo,
    q18: '' as YesNo,
    q19: '' as YesNo,
    q20: '' as YesNo,
    q21: '' as YesNo,
    q22: '' as YesNo,
    q2Reason: '',
    q3Condition: '',
    q3Medication: '',
    q6Vaccine: '',
    donorDeclarationAccepted: false,
  });

  const loadStatus = async () => {
    setLoadingStatus(true);
    try {
      const response = await api.get('/donors/eligibility/status');
      const data = response.data?.data ?? response.data;
      setHealthFormCompleted(Boolean(data?.healthFormCompleted));
      setAdminApproved(Boolean(data?.adminApproved));
      setSubmittedAt(data?.healthFormSubmittedAt ?? null);
    } catch {
      // Keep usable.
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    void loadStatus();
    void (async () => {
      try {
        const response = await api.get('/donors/hospital-options');
        const data = response.data?.data ?? response.data;
        setHospitals(Array.isArray(data) ? data : []);
      } catch {
        setHospitals([]);
      }
    })();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaved(false);
    setError('');

    if (!form.donorDeclarationAccepted) {
      setError('You must accept the donor declaration before submitting.');
      return;
    }

    const unanswered = questionItems.some((q) => !form[q.key]);
    if (unanswered) {
      setError('Please answer all health questionnaire questions.');
      return;
    }

    setSaving(true);
    try {
      await api.post('/donors/health-form', {
        selectedHospitalId: form.selectedHospitalId,
        personalInformation: {
          date: form.date,
          venue: form.venue,
          title: form.title,
          firstName: form.firstName,
          lastName: form.lastName,
          callingName: form.callingName,
          dateOfBirth: form.dateOfBirth,
          sex: form.sex,
          areaOfResidence: form.areaOfResidence,
          workplaceAddress: form.workplaceAddress,
          occupation: form.occupation,
          idType: form.idType,
          idNumber: form.idNumber,
          phoneNumber: form.phoneNumber,
          email: form.email,
          preferredContactMethod: form.preferredContactMethod,
        },
        donationHistory: {
          haveDonatedBefore: form.haveDonatedBefore,
          lastDonationDate: form.lastDonationDate,
          voluntaryTimes: form.voluntaryTimes,
          replacementTimes: form.replacementTimes,
          donorCardNumber: form.donorCardNumber,
        },
        replacementFamilyDonor: {
          patientName: form.patientName,
          hospital: form.hospital,
          ward: form.ward,
          relationshipToPatient: form.relationshipToPatient,
          referralReason: form.referralReason,
        },
        healthQuestionnaire: {
          answers: questionItems.reduce<Record<string, string>>((acc, q) => {
            acc[q.key] = form[q.key];
            return acc;
          }, {}),
          q2Reason: form.q2Reason,
          q3Condition: form.q3Condition,
          q3Medication: form.q3Medication,
          q6Vaccine: form.q6Vaccine,
        },
        donorDeclarationAccepted: form.donorDeclarationAccepted,
      });
      setSaved(true);
      await loadStatus();
    } catch (err: any) {
      const apiError = err?.response?.data?.error;
      const extracted = typeof apiError === 'string' ? apiError : apiError?.message;
      setError(extracted ?? 'Could not submit health form.');
    } finally {
      setSaving(false);
    }
  };

  const setAnswer = (key: string, value: YesNo) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  return (
    <section className="card space-y-4">
      <h1 className="text-2xl font-bold text-primary">Health & Eligibility Form</h1>
      <p className="text-sm text-gray-600">This digital form mirrors your clinical donor form. Complete all sections truthfully.</p>

      {loadingStatus ? <p className="text-sm text-muted">Checking status...</p> : null}
      {!loadingStatus ? (
        <div className="rounded border border-gray-200 bg-gray-50 p-3 text-sm">
          <p>
            Health form status:{' '}
            <span className={healthFormCompleted ? 'font-semibold text-green-700' : 'font-semibold text-amber-700'}>
              {healthFormCompleted ? 'Submitted' : 'Not submitted'}
            </span>
          </p>
          <p>
            Admin approval:{' '}
            <span className={adminApproved ? 'font-semibold text-green-700' : 'font-semibold text-amber-700'}>
              {adminApproved ? 'Approved' : 'Pending'}
            </span>
          </p>
          {submittedAt ? <p>Submitted at: {new Date(submittedAt).toLocaleString()}</p> : null}
        </div>
      ) : null}

      {saved ? <p className="rounded bg-green-50 p-2 text-sm text-green-700">Form submitted. Awaiting admin approval.</p> : null}
      {error ? <p className="rounded bg-red-50 p-2 text-sm text-red-700">{error}</p> : null}

      <form className="space-y-6" onSubmit={submit} autoComplete="off">
        <div className="space-y-2">
          <h2 className="text-lg font-semibold text-primary">Submission Hospital</h2>
          <select
            className="legacy-input"
            value={form.selectedHospitalId}
            onChange={(e) => setForm((v) => ({ ...v, selectedHospitalId: e.target.value }))}
            required
          >
            <option value="">Select Hospital</option>
            {hospitals.map((hospital) => (
              <option key={hospital.id} value={hospital.id}>
                {hospital.hospitalName} ({hospital.location})
              </option>
            ))}
          </select>
          <p className="text-xs text-muted">Your submission will be reviewed and approved by this hospital.</p>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-primary">1. Personal Information</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="legacy-input" placeholder="Date" type="date" value={form.date} onChange={(e) => setForm((v) => ({ ...v, date: e.target.value }))} />
            <input className="legacy-input" placeholder="Venue" value={form.venue} onChange={(e) => setForm((v) => ({ ...v, venue: e.target.value }))} />
            <input className="legacy-input" placeholder="Title (Mr/Mrs/Ms/Dr...)" value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} />
            <input className="legacy-input" placeholder="First Name" value={form.firstName} onChange={(e) => setForm((v) => ({ ...v, firstName: e.target.value }))} required />
            <input className="legacy-input" placeholder="Last Name" value={form.lastName} onChange={(e) => setForm((v) => ({ ...v, lastName: e.target.value }))} required />
            <input className="legacy-input" placeholder="Calling Name" value={form.callingName} onChange={(e) => setForm((v) => ({ ...v, callingName: e.target.value }))} />
            <input className="legacy-input" placeholder="Date of Birth" type="date" value={form.dateOfBirth} onChange={(e) => setForm((v) => ({ ...v, dateOfBirth: e.target.value }))} />
            <select className="legacy-input" value={form.sex} onChange={(e) => setForm((v) => ({ ...v, sex: e.target.value }))}>
              <option value="">Sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <input className="legacy-input" placeholder="Area of Residence" value={form.areaOfResidence} onChange={(e) => setForm((v) => ({ ...v, areaOfResidence: e.target.value }))} />
            <input className="legacy-input" placeholder="Address (Workplace)" value={form.workplaceAddress} onChange={(e) => setForm((v) => ({ ...v, workplaceAddress: e.target.value }))} />
            <input className="legacy-input" placeholder="Occupation" value={form.occupation} onChange={(e) => setForm((v) => ({ ...v, occupation: e.target.value }))} />
            <select className="legacy-input" value={form.idType} onChange={(e) => setForm((v) => ({ ...v, idType: e.target.value }))}>
              <option value="">ID Type</option>
              <option value="National ID">National ID</option>
              <option value="Passport">Passport</option>
              <option value="Driver's License">Driver's License</option>
              <option value="Voter ID">Voter ID</option>
              <option value="NHIS Card">NHIS Card</option>
              <option value="Student ID">Student ID</option>
              <option value="Employment ID">Employment ID</option>
              <option value="Other">Other</option>
            </select>
            <input className="legacy-input" placeholder="ID Number" value={form.idNumber} onChange={(e) => setForm((v) => ({ ...v, idNumber: e.target.value }))} />
            <input className="legacy-input" placeholder="Phone Number" value={form.phoneNumber} onChange={(e) => setForm((v) => ({ ...v, phoneNumber: e.target.value }))} />
            <input className="legacy-input" placeholder="E-mail" value={form.email} onChange={(e) => setForm((v) => ({ ...v, email: e.target.value }))} />
            <select className="legacy-input" value={form.preferredContactMethod} onChange={(e) => setForm((v) => ({ ...v, preferredContactMethod: e.target.value }))}>
              <option value="">Preferred Contact Method</option>
              <option value="Phone">Phone</option>
              <option value="SMS">SMS</option>
              <option value="Email">E-mail</option>
              <option value="Do not contact for blood donation">Do not contact for blood donation</option>
            </select>
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-primary">2. Donation History</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <select className="legacy-input" value={form.haveDonatedBefore} onChange={(e) => setForm((v) => ({ ...v, haveDonatedBefore: e.target.value as YesNo }))}>
              <option value="">Have you donated blood before?</option>
              <option value="Yes">Yes</option>
              <option value="No">No</option>
            </select>
            <input className="legacy-input" type="date" placeholder="If yes, last donation date" value={form.lastDonationDate} onChange={(e) => setForm((v) => ({ ...v, lastDonationDate: e.target.value }))} />
            <input className="legacy-input" placeholder="How many times as voluntary" value={form.voluntaryTimes} onChange={(e) => setForm((v) => ({ ...v, voluntaryTimes: e.target.value }))} />
            <input className="legacy-input" placeholder="How many times as replacement" value={form.replacementTimes} onChange={(e) => setForm((v) => ({ ...v, replacementTimes: e.target.value }))} />
            <input className="legacy-input sm:col-span-2" placeholder="Donor Card #" value={form.donorCardNumber} onChange={(e) => setForm((v) => ({ ...v, donorCardNumber: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-primary">3. Replacement / Family Donors Only</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <input className="legacy-input" placeholder="Name of Patient" value={form.patientName} onChange={(e) => setForm((v) => ({ ...v, patientName: e.target.value }))} />
            <input className="legacy-input" placeholder="Hospital" value={form.hospital} onChange={(e) => setForm((v) => ({ ...v, hospital: e.target.value }))} />
            <input className="legacy-input" placeholder="Ward" value={form.ward} onChange={(e) => setForm((v) => ({ ...v, ward: e.target.value }))} />
            <input className="legacy-input" placeholder="Relationship to Patient" value={form.relationshipToPatient} onChange={(e) => setForm((v) => ({ ...v, relationshipToPatient: e.target.value }))} />
            <textarea className="legacy-input sm:col-span-2" rows={2} placeholder="Reason / Notes (optional)" value={form.referralReason} onChange={(e) => setForm((v) => ({ ...v, referralReason: e.target.value }))} />
          </div>
        </div>

        <div className="space-y-3">
          <h2 className="text-lg font-semibold text-primary">4. Health Questionnaire</h2>
          <div className="space-y-2">
            {questionItems.map((item) => (
              <div key={item.key} className="grid items-center gap-2 rounded border border-gray-100 p-2 sm:grid-cols-[1fr_180px]">
                <p className="text-sm">{item.label}</p>
                <select className="legacy-input" value={form[item.key]} onChange={(e) => setAnswer(item.key, e.target.value as YesNo)} required>
                  <option value="">Select</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              </div>
            ))}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <textarea className="legacy-input" rows={2} placeholder="Q2 If yes, reason" value={form.q2Reason} onChange={(e) => setForm((v) => ({ ...v, q2Reason: e.target.value }))} />
            <textarea className="legacy-input" rows={2} placeholder="Q3 If yes, condition and medication" value={form.q3Condition} onChange={(e) => setForm((v) => ({ ...v, q3Condition: e.target.value }))} />
            <textarea className="legacy-input sm:col-span-2" rows={2} placeholder="Q6 If vaccinated, what vaccine?" value={form.q6Vaccine} onChange={(e) => setForm((v) => ({ ...v, q6Vaccine: e.target.value }))} />
          </div>
        </div>

        <label className="flex items-start gap-2 rounded border border-gray-200 p-3 text-sm">
          <input
            type="checkbox"
            checked={form.donorDeclarationAccepted}
            onChange={(e) => setForm((v) => ({ ...v, donorDeclarationAccepted: e.target.checked }))}
            className="mt-1"
          />
          <span>
            I confirm that information provided is true and complete, and I consent to required testing and donor safety protocols.
          </span>
        </label>

        <button className="btn-primary w-full disabled:cursor-not-allowed disabled:opacity-70" type="submit" disabled={saving}>
          {saving ? 'Submitting...' : 'Submit Full Eligibility Form'}
        </button>
      </form>
    </section>
  );
}
