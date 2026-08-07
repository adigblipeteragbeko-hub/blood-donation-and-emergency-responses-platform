export const EXPORT_FIELDS = [
  'name',
  'phone',
  'email',
  'bloodGroup',
  'region',
  'city',
  'hospital',
  'lastDonationDate',
  'eligibilityStatus',
] as const;

export type ExportField = (typeof EXPORT_FIELDS)[number];

export const EXPORT_FIELD_LABELS: Record<ExportField, string> = {
  name: 'Full Name',
  phone: 'Phone',
  email: 'Email',
  bloodGroup: 'Blood Group',
  region: 'Region',
  city: 'City',
  hospital: 'Preferred Hospital',
  lastDonationDate: 'Last Donation Date',
  eligibilityStatus: 'Eligibility Status',
};
