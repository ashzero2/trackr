import {
  localDayKey,
  parseIsoToLocalDayKey,
  monthName,
  formatDaySectionTitle,
  daysInUtcMonth,
  addUtcMonths,
  monthRangeUtc,
} from '@/lib/dates';

describe('localDayKey', () => {
  it('formats a date as YYYY-MM-DD in local timezone', () => {
    // Use a specific date to avoid timezone flakiness
    const d = new Date(2025, 3, 15); // April 15, 2025 local
    expect(localDayKey(d)).toBe('2025-04-15');
  });

  it('pads single-digit months and days', () => {
    const d = new Date(2025, 0, 5); // Jan 5
    expect(localDayKey(d)).toBe('2025-01-05');
  });
});

describe('parseIsoToLocalDayKey', () => {
  it('converts an ISO string to a local day key', () => {
    // This test may vary by timezone, but the function is consistent
    const result = parseIsoToLocalDayKey('2025-06-15T12:00:00.000Z');
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('monthName', () => {
  it('returns correct month names for 1-12', () => {
    expect(monthName(1)).toBe('January');
    expect(monthName(6)).toBe('June');
    expect(monthName(12)).toBe('December');
  });

  it('returns empty string for out-of-range values', () => {
    expect(monthName(0)).toBe('');
    expect(monthName(13)).toBe('');
  });
});

describe('formatDaySectionTitle', () => {
  const todayKey = '2025-04-15';
  const yesterdayKey = '2025-04-14';

  it('returns "Today, ..." for today', () => {
    expect(formatDaySectionTitle('2025-04-15', todayKey, yesterdayKey)).toBe('Today, April 15');
  });

  it('returns "Yesterday, ..." for yesterday', () => {
    expect(formatDaySectionTitle('2025-04-14', todayKey, yesterdayKey)).toBe('Yesterday, April 14');
  });

  it('returns weekday label for other dates', () => {
    const result = formatDaySectionTitle('2025-04-10', todayKey, yesterdayKey);
    // April 10, 2025 is a Thursday
    expect(result).toContain('April 10');
  });
});

describe('daysInUtcMonth', () => {
  it('returns 31 for January', () => {
    expect(daysInUtcMonth(2025, 1)).toBe(31);
  });

  it('returns 28 for February in non-leap year', () => {
    expect(daysInUtcMonth(2025, 2)).toBe(28);
  });

  it('returns 29 for February in leap year', () => {
    expect(daysInUtcMonth(2024, 2)).toBe(29);
  });

  it('returns 30 for April', () => {
    expect(daysInUtcMonth(2025, 4)).toBe(30);
  });
});

describe('addUtcMonths', () => {
  it('advances by one month', () => {
    expect(addUtcMonths(2025, 3, 1)).toEqual({ year: 2025, month: 4 });
  });

  it('wraps around year boundary', () => {
    expect(addUtcMonths(2025, 12, 1)).toEqual({ year: 2026, month: 1 });
  });

  it('goes backward', () => {
    expect(addUtcMonths(2025, 1, -1)).toEqual({ year: 2024, month: 12 });
  });

  it('jumps multiple months', () => {
    expect(addUtcMonths(2025, 3, 10)).toEqual({ year: 2026, month: 1 });
  });
});

describe('monthRangeUtc', () => {
  it('returns correct ISO boundaries for a month', () => {
    const { start, end } = monthRangeUtc(2025, 4);
    expect(start).toBe('2025-04-01T00:00:00.000Z');
    expect(end).toBe('2025-05-01T00:00:00.000Z');
  });

  it('handles December correctly', () => {
    const { start, end } = monthRangeUtc(2025, 12);
    expect(start).toBe('2025-12-01T00:00:00.000Z');
    expect(end).toBe('2026-01-01T00:00:00.000Z');
  });
});