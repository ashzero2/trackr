/** Curated ISO 4217 codes for onboarding / settings (expand as needed). */
export const SUPPORTED_CURRENCIES = [
  { code: 'USD', label: 'US Dollar' },
  { code: 'EUR', label: 'Euro' },
  { code: 'GBP', label: 'British Pound' },
  { code: 'INR', label: 'Indian Rupee' },
  { code: 'JPY', label: 'Japanese Yen' },
  { code: 'AUD', label: 'Australian Dollar' },
  { code: 'CAD', label: 'Canadian Dollar' },
  { code: 'CHF', label: 'Swiss Franc' },
  { code: 'CNY', label: 'Chinese Yuan' },
  { code: 'NZD', label: 'New Zealand Dollar' },
  { code: 'SGD', label: 'Singapore Dollar' },
  { code: 'KRW', label: 'South Korean Won' },
  { code: 'MXN', label: 'Mexican Peso' },
  { code: 'BRL', label: 'Brazilian Real' },
  { code: 'ZAR', label: 'South African Rand' },
] as const;

export type SupportedCurrencyCode = (typeof SUPPORTED_CURRENCIES)[number]['code'];

export function isSupportedCurrencyCode(code: string): code is SupportedCurrencyCode {
  return SUPPORTED_CURRENCIES.some((c) => c.code === code);
}

export function currencyLabel(code: string): string {
  const row = SUPPORTED_CURRENCIES.find((c) => c.code === code);
  return row ? `${row.label} (${row.code})` : code;
}
