/**
 * Format integer minor units (e.g. cents, paise) using Intl for the given ISO 4217 code.
 * Uses the runtime default locale (device) when `locale` is omitted.
 */
export function formatMoneyFromMinor(
  minorUnits: number,
  currencyCode: string,
  locale?: string,
): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      maximumFractionDigits: 2,
    }).format(minorUnits / 100);
  } catch {
    return `${(minorUnits / 100).toFixed(2)} ${currencyCode}`;
  }
}
