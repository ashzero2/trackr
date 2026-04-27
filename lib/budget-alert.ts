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
    const spent = spentMap.get(budget.categoryId)?.spentCents ?? 0;
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