/** YYYY-MM-DD in local timezone */
export function localDayKey(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseIsoToLocalDayKey(iso: string): string {
  return localDayKey(new Date(iso));
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
] as const;

export function monthName(m: number): string {
  return MONTHS[m - 1] ?? '';
}

/** e.g. "Today, April 5" or "Yesterday, April 4" or "Mon, April 3" */
export function formatDaySectionTitle(dayKey: string, todayKey: string, yesterdayKey: string): string {
  const [y, mo, d] = dayKey.split('-').map(Number);
  const label = `${MONTHS[mo - 1]} ${d}`;
  if (dayKey === todayKey) return `Today, ${label}`;
  if (dayKey === yesterdayKey) return `Yesterday, ${label}`;
  const date = new Date(y, mo - 1, d);
  const weekday = date.toLocaleDateString(undefined, { weekday: 'short' });
  return `${weekday}, ${label}`;
}

export function utcCalendarMonthNow(): { year: number; month: number } {
  const n = new Date();
  return { year: n.getUTCFullYear(), month: n.getUTCMonth() + 1 };
}

export function daysInUtcMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function addUtcMonths(year: number, month: number, delta: number): { year: number; month: number } {
  const d = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: d.getUTCFullYear(), month: d.getUTCMonth() + 1 };
}

export function formatTimeShort(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function monthRangeUtc(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

/** Days elapsed so far in a UTC month (capped to days in month). */
export function elapsedDaysInUtcMonth(year: number, month: number): number {
  const now = new Date();
  const nowYear = now.getUTCFullYear();
  const nowMonth = now.getUTCMonth() + 1;
  if (year !== nowYear || month !== nowMonth) return daysInUtcMonth(year, month);
  return Math.max(1, now.getUTCDate());
}
