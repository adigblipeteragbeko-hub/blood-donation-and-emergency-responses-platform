import { BloodGroup } from '../constants/bloodGroups';
import { api, unwrap } from './api';

export type DonationEntry = {
  id: string;
  donationNumber?: string | null;
  donatedAt: string;
  unitsDonated?: number | null;
  location?: string | null;
  notes?: string | null;
  status?: string | null;
  bloodGroup?: BloodGroup | string | null;
  hospital?: { hospitalName?: string | null; city?: string | null; region?: string | null } | null;
};

export type DonorProfile = {
  id: string;
  donorNumber?: string | null;
  fullName?: string | null;
  firstName?: string | null;
  otherNames?: string | null;
  surname?: string | null;
  bloodGroup?: BloodGroup | string | null;
  phone?: string | null;
  email?: string | null;
  user?: { email?: string | null; createdAt?: string | null } | null;
  location?: string | null;
  postalAddress?: string | null;
  dateOfBirth?: string | null;
  dateIssued?: string | null;
  eligibilityStatus?: boolean | null;
  availabilityStatus?: boolean | null;
  lastDonationDate?: string | null;
  nextEligibilityDate?: string | null;
  rewardPoints?: number | null;
  emergencyResponseCount?: number | null;
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  emergencyContactRelationship?: string | null;
  preferredHospital?: { hospitalName?: string | null; location?: string | null } | null;
  donationHistory?: DonationEntry[];
};

export type EligibilityStatus = {
  status?: string;
  eligibilityStatus?: boolean;
  availabilityStatus?: boolean;
  lastDonationDate?: string | null;
  nextEligibilityDate?: string | null;
  message?: string;
};

export async function getDonorProfile() {
  const response = await api.get('/donors/profile');
  return unwrap<DonorProfile>(response.data);
}

export async function getDonorEligibilityStatus() {
  const response = await api.get('/donors/eligibility/status');
  return unwrap<EligibilityStatus>(response.data);
}

export async function updateDonorAvailability(available: boolean) {
  const response = await api.patch('/donors/availability', { available });
  return unwrap<{ availabilityStatus: boolean }>(response.data);
}

