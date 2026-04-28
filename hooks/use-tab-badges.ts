import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useDatabase } from '@/contexts/database-context';

export type TabBadges = {
  /** True when at least one budget category has spent ≥ 100% of its limit */
  budgetExceeded: boolean;
  /** True when at least one recurring rule is due today or overdue */
  recurringDue: boolean;
};

/**
 * Lightweight hook that computes badge flags for the tab bar.
 * Re-checks whenever `dataVersion` changes or the app returns to foreground.
 */
export function useTabBadges(): TabBadges {
  const { ready, transactions, budgets, recurring, dataVersion } = useDatabase();
  const [badges, setBadges] = useState<TabBadges>({ budgetExceeded: false, recurringDue: false });

  const check = useCallback(async () => {
    if (!ready || !transactions || !budgets || !recurring) return;

    const now = new Date();
    const year = now.getUTCFullYear();
    const month = now.getUTCMonth() + 1;
    const todayIso = now.toISOString().slice(0, 10);

    // Check budgets: any category where spent >= limit?
    const [budgetList, spendingByCat] = await Promise.all([
      budgets.listForMonth(year, month),
      transactions.spendingByCategoryForMonth(year, month),
    ]);

    let budgetExceeded = false;
    for (const b of budgetList) {
      if (!b.categoryId) continue;
      const spent = spendingByCat.find((c) => c.categoryId === b.categoryId)?.spentCents ?? 0;
      if (spent >= b.limitCents) {
        budgetExceeded = true;
        break;
      }
    }

    // Check recurring: any rule with nextDueAt <= today?
    const rules = await recurring.listAll();
    const recurringDue = rules.some((r) => r.nextDueAt <= todayIso);

    setBadges({ budgetExceeded, recurringDue });
  }, [ready, transactions, budgets, recurring, dataVersion]);

  useEffect(() => {
    void check();
  }, [check]);

  // Re-check on app foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') void check();
    });
    return () => sub.remove();
  }, [check]);

  return badges;
}