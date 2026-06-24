import { BloodGroup } from '@prisma/client';

const BLOOD_COMPATIBILITY: Record<BloodGroup, BloodGroup[]> = {
  UNKNOWN: [],
  O_NEG: ['O_NEG'],
  O_POS: ['O_POS', 'O_NEG'],
  A_NEG: ['A_NEG', 'O_NEG'],
  A_POS: ['A_POS', 'A_NEG', 'O_POS', 'O_NEG'],
  B_NEG: ['B_NEG', 'O_NEG'],
  B_POS: ['B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
  AB_NEG: ['AB_NEG', 'A_NEG', 'B_NEG', 'O_NEG'],
  AB_POS: ['AB_POS', 'AB_NEG', 'A_POS', 'A_NEG', 'B_POS', 'B_NEG', 'O_POS', 'O_NEG'],
};

export function getCompatibleDonorGroups(group: BloodGroup): BloodGroup[] {
  return BLOOD_COMPATIBILITY[group] ?? [];
}

export function getCompatibilityRank(requested: BloodGroup, donor: BloodGroup): number {
  if (requested === donor) return 0;
  return getCompatibleDonorGroups(requested).indexOf(donor) + 1;
}
