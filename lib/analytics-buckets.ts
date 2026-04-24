import type { TransactionWithCategory } from '@/types/finance';

import { daysInUtcMonth, localDayKey, parseIsoToLocalDayKey } from '@/lib/dates';

export function bucketUtcMonthDailyExpenses(
  txs: TransactionWithCategory[],
  year: number,
  month: number,
): number[] {
  const dim = daysInUtcMonth(year, month);
  const arr = Array(dim).fill(0);
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    const d = new Date(t.occurredAt);
    if (d.getUTCFullYear() !== year || d.getUTCMonth() + 1 !== month) continue;
    arr[d.getUTCDate() - 1] += t.amountCents;
  }
  return arr;
}

/** Sum each 7-day slice of the month (partial last slice). */
export function compressMonthDailyToWeekBars(daily: number[]): { values: number[]; labels: string[] } {
  const values: number[] = [];
  const labels: string[] = [];
  for (let i = 0; i < daily.length; i += 7) {
    const slice = daily.slice(i, i + 7);
    const sum = slice.reduce((a, b) => a + b, 0);
    values.push(sum);
    labels.push(`W${values.length}`);
  }
  return { values, labels };
}

export function bucketLast7LocalDays(txs: TransactionWithCategory[]): { values: number[]; labels: string[] } {
  const sumByDay = new Map<string, number>();
  for (const t of txs) {
    if (t.type !== 'expense') continue;
    const key = parseIsoToLocalDayKey(t.occurredAt);
    sumByDay.set(key, (sumByDay.get(key) ?? 0) + t.amountCents);
  }
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const values: number[] = [];
  const labels: string[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(end);
    d.setDate(d.getDate() - i);
    d.setHours(0, 0, 0, 0);
    labels.push(d.toLocaleDateString(undefined, { weekday: 'short' }));
    values.push(sumByDay.get(localDayKey(d)) ?? 0);
  }
  return { values, labels };
}

/** Returns a plain-English insight based on the top spending category for the month. */
export function computeMonthInsight(
  byCat: { categoryName: string; spentCents: number }[],
  totalExpenseCents: number,
): string {
  if (totalExpenseCents <= 0 || byCat.length === 0) {
    return 'Add expenses to unlock personalized insights.';
  }
  const top = byCat.reduce((a, b) => (b.spentCents > a.spentCents ? b : a));
  const ratio = top.spentCents / totalExpenseCents;
  if (ratio >= 0.12) {
    return `${top.categoryName} makes up about ${Math.round(ratio * 100)}% of your spending this month—worth a look if you're trimming costs.`;
  }
  return `You're spread across ${byCat.length} spending categories this month. Nice balance.`;
}

export function peakDayLabel(values: number[], labels: string[]): string | undefined {
  if (values.length === 0) return undefined;
  let maxI = 0;
  for (let i = 1; i < values.length; i++) {
    if (values[i] > values[maxI]) maxI = i;
  }
  if (values[maxI] <= 0) return undefined;
  return `Peak ${labels[maxI] ?? ''}`.trim();
}
