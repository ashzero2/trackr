import AsyncStorage from '@react-native-async-storage/async-storage';

import type { BudgetRepository } from '@/data/budget-repository';
import type { TransactionRepository } from '@/data/transaction-repository';
import { NOTIF_KEY, scheduleLocal } from '@/lib/notifications';

type BudgetAlertDeps = {
  transactions: TransactionRepository;
  budgets: BudgetRepository;
};

/**
 * Check whether any category budgets have crossed 80% or 100% thresholds
 * after the latest transaction write.
 *
 * Fires a local notification for each breach (once per threshold per month).
 * De-duplication uses AsyncStorage to avoid repeat alerts within the same month.
 */
export async function checkBudgetAlerts(
  deps: BudgetAlertDeps,
  year: number,
  month: number,
): Promise<void> {
  // Honour the user's notification opt-in preference
  const enabled = await AsyncStorage.getItem(NOTIF_KEY.budgetAlert);
  if (enabled === 'false') return; // default is true (null = enabled)

  const [budgetRows, spentByCat] = await Promise.all([
    deps.budgets.listForMonth(year, month),
    deps.transactions.spendingByCategoryForMonth(year, month),
  ]);

  const spentMap = new Map(spentByCat.map((r) => [r.categoryId, r]));

  for (const budget of budgetRows) {
    if (!budget.categoryId || budget.limitCents <= 0) continue;

    let spent: number;
    const period = budget.period ?? 'monthly';

    if (period === 'weekly') {
      // Compute current week's spending (Mon–Sun)
      const now = new Date();
      const dayOfWeek = now.getDay(); // 0=Sun
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + mondayOffset);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekStart.getDate() + 7);
      const weekTxs = await deps.transactions.listExpensesBetween(
        weekStart.toISOString(),
        weekEnd.toISOString(),
      );
      spent = weekTxs
        .filter((t) => t.categoryId === budget.categoryId)
        .reduce((sum, t) => sum + t.amountCents, 0);
    } else if (period === 'yearly') {
      // Compute year-to-date spending
      const yearStart = `${year}-01-01T00:00:00.000Z`;
      const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;
      const yearTxs = await deps.transactions.listExpensesBetween(yearStart, yearEnd);
      spent = yearTxs
        .filter((t) => t.categoryId === budget.categoryId)
        .reduce((sum, t) => sum + t.amountCents, 0);
    } else {
      // monthly — use pre-fetched data
      spent = spentMap.get(budget.categoryId)?.spentCents ?? 0;
    }

    const pct = spent / budget.limitCents;
    const catName = spentMap.get(budget.categoryId)?.categoryName ?? 'Budget';
    const monthKey = `${year}-${String(month).padStart(2, '0')}`;

    if (pct >= 1) {
      const dedupeKey = `@trackr/alert-100-${budget.categoryId}-${monthKey}`;
      const alerted = await AsyncStorage.getItem(dedupeKey);
      if (!alerted) {
        await scheduleLocal({
          id: `budget-100-${budget.categoryId}-${monthKey}`,
          title: `🚨 ${catName} budget exceeded!`,
          body: formatBudgetBody(spent, budget.limitCents, catName),
        });
        await AsyncStorage.setItem(dedupeKey, '1');
      }
    } else if (pct >= 0.8) {
      const dedupeKey = `@trackr/alert-80-${budget.categoryId}-${monthKey}`;
      const alerted = await AsyncStorage.getItem(dedupeKey);
      if (!alerted) {
        await scheduleLocal({
          id: `budget-80-${budget.categoryId}-${monthKey}`,
          title: `⚠️ ${catName} budget at ${Math.round(pct * 100)}%`,
          body: formatBudgetBody(spent, budget.limitCents, catName),
        });
        await AsyncStorage.setItem(dedupeKey, '1');
      }
    }
  }
}

function formatBudgetBody(spentCents: number, limitCents: number, catName: string): string {
  const fmt = (c: number) => (c / 100).toFixed(2);
  return `${catName}: ${fmt(spentCents)} spent of ${fmt(limitCents)} limit`;
}

const ALERT_KEY_PREFIX = '@trackr/alert-';

/**
 * Remove stale budget alert deduplication keys from past months.
 * Should be called periodically (e.g., on app start) to prevent
 * AsyncStorage accumulation over time.
 */
export async function cleanupStaleBudgetAlertKeys(): Promise<void> {
  try {
    const allKeys = await AsyncStorage.getAllKeys();
    const alertKeys = allKeys.filter((k) => k.startsWith(ALERT_KEY_PREFIX));
    if (alertKeys.length === 0) return;

    const now = new Date();
    const currentMonthKey = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

    const staleKeys = alertKeys.filter((key) => {
      // Key format: @trackr/alert-{80|100}-{categoryId}-{YYYY-MM}
      const monthMatch = key.match(/(\d{4}-\d{2})$/);
      if (!monthMatch) return true; // malformed — remove
      return monthMatch[1] !== currentMonthKey;
    });

    if (staleKeys.length > 0) {
      await AsyncStorage.multiRemove(staleKeys);
    }
  } catch {
    // Non-critical — silently ignore cleanup failures
  }
}
