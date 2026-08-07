import { AuthUser, Role } from '../types/auth';

export type AccountIdentityInput = {
  user: AuthUser | null;
  donorProfile?: {
    fullName?: string | null;
    firstName?: string | null;
    otherNames?: string | null;
    surname?: string | null;
    donorNumber?: string | null;
    bloodGroup?: string | null;
    eligibilityStatus?: boolean | null;
    availabilityStatus?: boolean | null;
    profileImageUrl?: string | null;
    email?: string | null;
    user?: { email?: string | null } | null;
  } | null;
  hospitalProfile?: {
    id?: string | null;
    hospitalName?: string | null;
    city?: string | null;
    region?: string | null;
    logoUrl?: string | null;
    isApproved?: boolean | null;
    bloodBankAvailable?: boolean | null;
  } | null;
};

export type AccountIdentity = {
  id: string;
  email: string;
  role: Role;
  roleLabel: string;
  displayName: string;
  initials: string;
  avatarUrl?: string | null;
  accountStatus: string;
  donorReference?: string | null;
  bloodGroup?: string | null;
  eligibilityStatus?: string | null;
  hospitalId?: string | null;
  hospitalName?: string | null;
  city?: string | null;
  region?: string | null;
};

export function roleLabel(role?: string | null) {
  switch (role) {
    case 'ADMIN':
      return 'Admin';
    case 'DONOR':
      return 'Donor';
    case 'HOSPITAL_ADMIN':
      return 'Hospital Admin';
    default:
      return 'User';
  }
}

export function loginPathForRole(role?: string | null) {
  if (role === 'ADMIN' || role === 'HOSPITAL_ADMIN') return '/login';
  return '/login';
}

export function displayNameFromEmail(email?: string | null) {
  const local = email?.split('@')[0]?.trim();
  if (!local) return 'Account';
  return local
    .replace(/[._-]+/g, ' ')
    .split(' ')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export function initialsFromName(value?: string | null) {
  const words = value?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length === 0) return 'A';
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

export function formatBloodGroup(value?: string | null) {
  if (!value) return undefined;
  if (value === 'UNKNOWN') return 'Unknown';
  return value.replace('_POS', '+').replace('_NEG', '-');
}

export function buildAccountIdentity({ user, donorProfile, hospitalProfile }: AccountIdentityInput): AccountIdentity | null {
  if (!user) return null;

  const donorName =
    donorProfile?.fullName?.trim()
    || [donorProfile?.firstName, donorProfile?.otherNames, donorProfile?.surname].filter(Boolean).join(' ').trim();
  const donorEmail = donorProfile?.email?.trim() || donorProfile?.user?.email?.trim();
  const email = donorEmail || user.email;
  const hospitalName = hospitalProfile?.hospitalName?.trim();
  const displayName = hospitalName || donorName || displayNameFromEmail(email);
  const accountStatus = user.role === 'DONOR'
    ? donorProfile?.eligibilityStatus
      ? 'Approved donor'
      : 'Clinical review pending'
    : user.role === 'HOSPITAL_ADMIN'
      ? hospitalProfile?.isApproved
        ? 'Verified facility'
        : 'Facility verification pending'
      : 'Operational account';

  return {
    id: user.id,
    email,
    role: user.role,
    roleLabel: roleLabel(user.role),
    displayName,
    initials: initialsFromName(displayName),
    avatarUrl: donorProfile?.profileImageUrl ?? user.profileImageUrl ?? hospitalProfile?.logoUrl ?? null,
    accountStatus,
    donorReference: donorProfile?.donorNumber ?? null,
    bloodGroup: formatBloodGroup(donorProfile?.bloodGroup),
    eligibilityStatus: donorProfile?.eligibilityStatus ? 'Approved' : donorProfile ? 'Pending review' : null,
    hospitalId: hospitalProfile?.id ?? null,
    hospitalName,
    city: hospitalProfile?.city ?? null,
    region: hospitalProfile?.region ?? null,
  };
}

export function greetingForRole(identity: AccountIdentity | null) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  if (!identity) return greeting;
  if (identity.role === 'DONOR') return `${greeting}, ${identity.displayName.split(' ')[0]}`;
  if (identity.role === 'HOSPITAL_ADMIN') return `${greeting}, ${identity.hospitalName ?? identity.displayName}`;
  return `${greeting}, ${identity.roleLabel}`;
}
