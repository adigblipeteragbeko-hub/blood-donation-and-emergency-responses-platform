export type CountryPhone = {
  id: string;
  name: string;
  dialCode: string;
  nationalLength: number;
};

export const COUNTRY_PHONE_OPTIONS: CountryPhone[] = [
  { id: 'GH', name: 'Ghana', dialCode: '233', nationalLength: 9 },
  { id: 'NG', name: 'Nigeria', dialCode: '234', nationalLength: 10 },
  { id: 'KE', name: 'Kenya', dialCode: '254', nationalLength: 9 },
  { id: 'ZA', name: 'South Africa', dialCode: '27', nationalLength: 9 },
  { id: 'US', name: 'United States', dialCode: '1', nationalLength: 10 },
  { id: 'GB', name: 'United Kingdom', dialCode: '44', nationalLength: 10 },
];

export const DEFAULT_COUNTRY_PHONE = COUNTRY_PHONE_OPTIONS[0];

export function sanitizePhoneDigits(value: string) {
  return value.replace(/\D/g, '');
}

export function normalizeNationalNumber(rawInput: string, country: CountryPhone) {
  let digits = sanitizePhoneDigits(rawInput);
  if (digits.startsWith('0') && digits.length >= country.nationalLength) {
    digits = digits.slice(1);
  }
  return digits;
}

export function toE164(country: CountryPhone, nationalNumber: string) {
  return `+${country.dialCode}${nationalNumber}`;
}
