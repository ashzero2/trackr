/**
 * Format a raw amount string (as entered on the number pad) with locale-aware
 * thousand separators for the preview display.
 *
 * Examples (en-US locale):
 *   "123456"   → "123,456"
 *   "1234.5"   → "1,234.5"
 *   "0."       → "0."
 *   ""         → "0"
 */
export function formatPreviewAmount(raw: string): string {
  if (!raw || raw === '0') return '0';

  const dotIdx = raw.indexOf('.');
  const intPart = dotIdx === -1 ? raw : raw.slice(0, dotIdx);
  const decPart = dotIdx === -1 ? '' : raw.slice(dotIdx); // includes the dot

  // Format the integer part with thousand separators using Intl
  let formattedInt: string;
  try {
    formattedInt = new Intl.NumberFormat(undefined, {
      useGrouping: true,
      maximumFractionDigits: 0,
    }).format(Number(intPart) || 0);
  } catch {
    // Fallback: manual grouping
    formattedInt = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  return formattedInt + decPart;
}