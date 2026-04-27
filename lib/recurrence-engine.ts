import type { RecurrenceFrequency } from '@/types/finance';

/**
 * Compute the next due date after `currentDueAt` for the given frequency.
 *
 * All dates are ISO date strings (YYYY-MM-DD).
 * The function is pure — no side effects.
 */
export function computeNextDue(
  frequency: RecurrenceFrequency,
  currentDueAt: string,
  dayOfMonth?: number | null,
  dayOfWeek?: number | null,
): string {
  const date = new Date(currentDueAt + 'T00:00:00Z');

  switch (frequency) {
    case 'daily': {
      date.setUTCDate(date.getUTCDate() + 1);
      break;
    }

    case 'weekly': {
      date.setUTCDate(date.getUTCDate() + 7);
      if (dayOfWeek != null) {
        // Snap to the next occurrence of the target weekday
        const current = date.getUTCDay();
        const diff = ((dayOfWeek - current) + 7) % 7;
        date.setUTCDate(date.getUTCDate() + diff);
      }
      break;
    }

    case 'biweekly': {
      date.setUTCDate(date.getUTCDate() + 14);
      if (dayOfWeek != null) {
        const current = date.getUTCDay();
        const diff = ((dayOfWeek - current) + 7) % 7;
        date.setUTCDate(date.getUTCDate() + diff);
      }
      break;
    }

    case 'monthly': {
      const targetDay = dayOfMonth ?? date.getUTCDate();
      date.setUTCMonth(date.getUTCMonth() + 1);
      // Clamp to last day of the resulting month
      const lastDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
      date.setUTCDate(Math.min(targetDay, lastDay));
      break;
    }

    case 'yearly': {
      date.setUTCFullYear(date.getUTCFullYear() + 1);
      break;
    }
  }

  return toIsoDate(date);
}

/** Format a UTC Date as YYYY-MM-DD */
export function toIsoDate(date: Date): string {
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Return today's date as YYYY-MM-DD (UTC). */
export function todayIsoDate(): string {
  return toIsoDate(new Date());
}

/** Return a human-readable label for a frequency. */
export function frequencyLabel(freq: RecurrenceFrequency): string {
  switch (freq) {
    case 'daily': return 'Daily';
    case 'weekly': return 'Weekly';
    case 'biweekly': return 'Every 2 weeks';
    case 'monthly': return 'Monthly';
    case 'yearly': return 'Yearly';
  }
}