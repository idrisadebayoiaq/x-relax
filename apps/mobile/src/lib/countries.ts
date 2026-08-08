/** Common signup countries. NG → NGN payments; everything else → USD payments. */
export const COUNTRIES: { code: string; name: string }[] = [
  { code: 'NG', name: 'Nigeria' },
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'GH', name: 'Ghana' },
  { code: 'KE', name: 'Kenya' },
  { code: 'ZA', name: 'South Africa' },
  { code: 'AE', name: 'United Arab Emirates' },
  { code: 'IN', name: 'India' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'FR', name: 'France' },
  { code: 'NL', name: 'Netherlands' },
  { code: 'IE', name: 'Ireland' },
  { code: 'OTHER', name: 'Other' },
];

export function paymentMethodForCountry(countryCode?: string | null): 'ngn_opay' | 'usd_lead_bank' {
  return countryCode === 'NG' ? 'ngn_opay' : 'usd_lead_bank';
}

export function countryName(code?: string | null) {
  if (!code) return 'Unknown';
  return COUNTRIES.find((c) => c.code === code)?.name ?? code;
}
