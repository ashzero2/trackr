import type { TransactionWithCategory } from '@/types/finance';

import { daysInUtcMonth, elapsedDaysInUtcMonth, localDayKey, parseIsoToLocalDayKey } from '@/lib/dates';

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

// ---------------------------------------------------------------------------
// Rotating insight variants — pick one per session/refresh
// ---------------------------------------------------------------------------

type InsightInput = {
  byCat: { categoryName: string; spentCents: number }[];
  totalExpenseCents: number;
  totalIncomeCents: number;
  budgetLimitCents: number;
  prevMonthExpenseCents: number;
};

type InsightResult = { label: string; body: string } | null;

function topCategoryInsight(i: InsightInput): InsightResult {
  if (i.totalExpenseCents <= 0 || i.byCat.length === 0) return null;
  const top = i.byCat.reduce((a, b) => (b.spentCents > a.spentCents ? b : a));
  const pct = Math.round((top.spentCents / i.totalExpenseCents) * 100);
  if (pct < 10) return null;
  return { label: 'Top category', body: `${top.categoryName} is ${pct}% of spending this month.` };
}

function budgetCountdownInsight(i: InsightInput): InsightResult {
  if (i.budgetLimitCents <= 0) return null;
  const left = i.budgetLimitCents - i.totalExpenseCents;
  if (left <= 0) return { label: 'Budget alert', body: 'You\'ve exceeded your combined budget limit this month.' };
  const pct = Math.round((left / i.budgetLimitCents) * 100);
  return { label: 'Budget remaining', body: `${pct}% of your monthly budget is still available.` };
}

function savingsRateInsight(i: InsightInput): InsightResult {
  if (i.totalIncomeCents <= 0 || i.totalExpenseCents <= 0) return null;
  const saved = i.totalIncomeCents - i.totalExpenseCents;
  if (saved <= 0) return { label: 'Spending > income', body: 'You\'ve spent more than earned this month. Review your recent expenses.' };
  const rate = Math.round((saved / i.totalIncomeCents) * 100);
  return { label: 'Savings rate', body: `You're saving ${rate}% of your income this month. Keep it up!` };
}

function categoryCountInsight(i: InsightInput): InsightResult {
  if (i.byCat.length < 2) return null;
  const active = i.byCat.filter((c) => c.spentCents > 0).length;
  if (active <= 1) return null;
  return { label: 'Diversity', body: `Spending across ${active} categories — a well-rounded month.` };
}

function vsLastMonthInsight(i: InsightInput): InsightResult {
  if (i.prevMonthExpenseCents <= 0 || i.totalExpenseCents <= 0) return null;
  const change = Math.round(((i.totalExpenseCents - i.prevMonthExpenseCents) / i.prevMonthExpenseCents) * 100);
  if (Math.abs(change) < 5) return { label: 'Steady pace', body: 'Spending is roughly the same as last month.' };
  if (change < 0) return { label: 'Trending down', body: `You're spending ${Math.abs(change)}% less than last month. Nice work!` };
  return { label: 'Trending up', body: `Spending is up ${change}% compared to last month.` };
}

const INSIGHT_GENERATORS = [
  topCategoryInsight,
  budgetCountdownInsight,
  savingsRateInsight,
  categoryCountInsight,
  vsLastMonthInsight,
];

/**
 * Pick a rotating insight from multiple generators.
 * Uses a session-stable index so the insight stays consistent until refresh.
 */
let insightSessionSeed: number | null = null;

export function computeRotatingInsight(input: InsightInput): { label: string; body: string } {
  if (insightSessionSeed === null) {
    insightSessionSeed = Math.floor(Math.random() * INSIGHT_GENERATORS.length);
  }
  // Try each generator starting from the session seed
  for (let attempt = 0; attempt < INSIGHT_GENERATORS.length; attempt++) {
    const idx = (insightSessionSeed + attempt) % INSIGHT_GENERATORS.length;
    const result = INSIGHT_GENERATORS[idx]!(input);
    if (result) return result;
  }
  return { label: 'Smart insight', body: computeMonthInsight(input.byCat, input.totalExpenseCents) };
}

/**
 * Projects end-of-month spend from current pace.
 * Returns null before day 3 (too noisy) or for past months.
 */
export function computeVelocityInsight(
  year: number,
  month: number,
  totalExpenseCents: number,
  prevMonthExpenseCents: number,
): { projectedCents: number; vsLastMonthPct: number | null } | null {
  const elapsed = elapsedDaysInUtcMonth(year, month);
  const total = daysInUtcMonth(year, month);
  if (elapsed < 3 || elapsed >= total || totalExpenseCents <= 0) return null;
  const projectedCents = Math.round((totalExpenseCents / elapsed) * total);
  const vsLastMonthPct =
    prevMonthExpenseCents > 0
      ? Math.round(((projectedCents - prevMonthExpenseCents) / prevMonthExpenseCents) * 100)
      : null;
  return { projectedCents, vsLastMonthPct };
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
