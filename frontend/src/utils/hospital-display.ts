const knownAbbreviations: Record<string, string> = {
  'HO TEACHING': 'Ho Teaching Hospital',
  'HO TEACHING HOSPITAL': 'Ho Teaching Hospital',
};

export function formatHospitalDisplayName(value?: string | null) {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'Hospital';
  const known = knownAbbreviations[trimmed.toUpperCase()];
  if (known) return known;
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return trimmed;
}
