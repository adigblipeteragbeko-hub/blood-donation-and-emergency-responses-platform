import { DonorProfile } from '../services/donor';

export function donorEmail(profile?: DonorProfile | null) {
  return profile?.email?.trim() || profile?.user?.email?.trim() || '';
}

export function donorAddress(profile?: DonorProfile | null) {
  return profile?.postalAddress?.trim() || profile?.location?.trim() || '';
}

export function donorDisplayName(profile?: DonorProfile | null) {
  return profile?.fullName?.trim() || [profile?.firstName, profile?.otherNames, profile?.surname].filter(Boolean).join(' ').trim();
}

export function hasValue(value?: string | null) {
  return Boolean(value?.trim());
}
