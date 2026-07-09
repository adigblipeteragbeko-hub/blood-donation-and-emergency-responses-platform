export const BLOOD_GROUPS = [
  { value: 'UNKNOWN', label: 'Unknown / Not Tested Yet' },
  { value: 'O_POS', label: 'O+' },
  { value: 'O_NEG', label: 'O-' },
  { value: 'A_POS', label: 'A+' },
  { value: 'A_NEG', label: 'A-' },
  { value: 'B_POS', label: 'B+' },
  { value: 'B_NEG', label: 'B-' },
  { value: 'AB_POS', label: 'AB+' },
  { value: 'AB_NEG', label: 'AB-' },
] as const;

export type BloodGroup = (typeof BLOOD_GROUPS)[number]['value'];

export function formatBloodGroup(value?: string | null) {
  if (!value) return 'Not recorded';
  return BLOOD_GROUPS.find((group) => group.value === value)?.label ?? value;
}
