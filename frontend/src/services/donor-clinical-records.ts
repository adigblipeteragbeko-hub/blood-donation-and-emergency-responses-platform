import api from './api';

const unwrap = <T>(response: any): T => response.data?.data ?? response.data;

export type ClinicalStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'HOSPITAL_REVIEW'
  | 'OFFICE_USE_COMPLETED'
  | 'APPROVED'
  | 'REJECTED'
  | 'TEMPORARILY_DEFERRED'
  | 'PERMANENTLY_DEFERRED';

export type HealthAnswer = {
  questionKey: string;
  questionText: string;
  answer: boolean;
  details?: string;
};

export type HealthAnswerPayload = {
  questionKey: string;
  questionText: string;
  answer: boolean;
  details?: string | null;
};

export type DonorClinicalRecord = {
  id: string;
  status: ClinicalStatus;
  selectedHospitalId?: string | null;
  venue?: string | null;
  firstName?: string | null;
  otherNames?: string | null;
  lastName?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  areaOfResidence?: string | null;
  addressOrWorkplace?: string | null;
  idType?: string | null;
  idNumber?: string | null;
  donorType?: string | null;
  hasDonatedBefore?: boolean | null;
  lastDonationDate?: string | null;
  donorCardNumber?: string | null;
  patientName?: string | null;
  patientHospital?: string | null;
  requestReference?: string | null;
  relationshipToPatient?: string | null;
  dateOfBirth?: string | null;
  sex?: string | null;
  donorRiskFlag: boolean;
  donorRiskSummary?: string | null;
  reviewNotes?: string | null;
  createdAt: string;
  updatedAt: string;
  submittedAt?: string | null;
  hospitalReviewedAt?: string | null;
  officeCompletedAt?: string | null;
  finalDecisionAt?: string | null;
  healthAnswers?: HealthAnswer[];
  donor?: {
    id: string;
    donorNumber?: string | null;
    fullName: string;
    firstName?: string | null;
    otherNames?: string | null;
    surname?: string | null;
    bloodGroup: string;
    location: string;
    lastDonationDate?: string | null;
    nextEligibilityDate?: string | null;
    user?: { email: string };
  };
  selectedHospital?: { id: string; hospitalName: string; location: string } | null;
  clinicalReview?: any;
  auditTrails?: Array<{ id: string; action: string; description?: string; createdAt: string; actor?: { email: string; role: string } | null }>;
};

export type ClinicalDraftPayload = Record<string, unknown> & { healthAnswers?: HealthAnswerPayload[] };

export async function getMyClinicalRecords() {
  return unwrap<{
    items: DonorClinicalRecord[];
    latest: DonorClinicalRecord | null;
    donorProfile?: {
      firstName?: string | null;
      otherNames?: string | null;
      surname?: string | null;
      fullName?: string | null;
      email?: string | null;
      phone?: string | null;
    };
  }>(await api.get('/donor-clinical-records/me'));
}

export async function saveClinicalDraft(payload: ClinicalDraftPayload, id?: string) {
  if (id) return unwrap<DonorClinicalRecord>(await api.patch(`/donor-clinical-records/${id}/draft`, payload));
  return unwrap<DonorClinicalRecord>(await api.post('/donor-clinical-records/draft', payload));
}

export async function submitClinicalRecord(id: string) {
  return unwrap<DonorClinicalRecord>(await api.post(`/donor-clinical-records/${id}/submit`));
}

export async function getClinicalReviewQueue(params: Record<string, string | number | undefined>) {
  return unwrap<{ total: number; items: DonorClinicalRecord[] }>(await api.get('/donor-clinical-records/review-queue', { params }));
}

export async function getClinicalRecord(id: string) {
  return unwrap<DonorClinicalRecord>(await api.get(`/donor-clinical-records/${id}`));
}

export async function updateClinicalReview(id: string, payload: { status?: string; reviewNotes?: string }) {
  return unwrap<DonorClinicalRecord>(await api.patch(`/donor-clinical-records/${id}/review`, payload));
}

export async function updateOfficeUse(id: string, payload: Record<string, unknown>) {
  return unwrap<DonorClinicalRecord>(await api.patch(`/donor-clinical-records/${id}/office-use`, payload));
}

export async function downloadClinicalRecordExport(id: string) {
  const response = await api.get(`/donor-clinical-records/${id}/pdf`, { responseType: 'blob' });
  const url = window.URL.createObjectURL(response.data);
  const link = document.createElement('a');
  link.href = url;
  link.download = `donor-clinical-record-${id}.txt`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

