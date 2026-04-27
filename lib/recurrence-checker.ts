import * as Crypto from 'expo-crypto';

import type { RecurringRepository } from '@/data/recurring-repository';
import type { TransactionRepository } from '@/data/transaction-repository';
import { computeNextDue, todayIsoDate } from '@/lib/recurrence-engine';
import type { RecurringTransaction } from '@/types/finance';

export type RecurrenceCheckerDeps = {
  recurring: RecurringRepository;
  transactions: TransactionRepository;
  /** Optional: called for rules that need user confirmation (autoInsert = false). */
  onConfirmRequired?: (rule: RecurringTransaction) => void;
};

/**
 * Check for recurring rules that are due today or overdue.
 *
 * - If `autoInsert = true`: inserts the transaction silently and advances `next_due_at`.
 * - If `autoInsert = false`: calls `onConfirmRequired` so the UI can prompt the user.
 *
 * Should be called once per app foreground event.
 */
export async function checkAndProcessRecurring(deps: RecurrenceCheckerDeps): Promise<void> {
  const today = todayIsoDate();
  const dueRules = await deps.recurring.listDue(today);

  for (const rule of dueRules) {
    if (rule.autoInsert) {
      await autoInsertRule(rule, today, deps);
    } else {
      deps.onConfirmRequired?.(rule);
    }
  }
}

/**
 * Inserts the transaction for the given rule and advances `next_due_at`.
 * Exported so it can also be called from the confirmation UI after user approval.
 */
export async function autoInsertRule(
  rule: RecurringTransaction,
  today: string,
  deps: Pick<RecurrenceCheckerDeps, 'recurring' | 'transactions'>,
): Promise<void> {
  const id = await Crypto.randomUUID();
  const iso = new Date(today + 'T12:00:00.000Z').toISOString();

  await deps.transactions.insert(
    {
      id,
      amountCents: rule.amountCents,
      type: rule.type,
      categoryId: rule.categoryId,
      occurredAt: iso,
      note: rule.note ?? `Auto: ${rule.title}`,
      paymentMethod: rule.paymentMethod,
      tripId: null,
      currencyCode: rule.currencyCode,
      amountBaseCents: rule.amountCents,
      exchangeRateToBase: 1,
    },
    { skipOuterTransaction: false },
  );

  const nextDueAt = computeNextDue(
    rule.frequency,
    rule.nextDueAt,
    rule.dayOfMonth,
    rule.dayOfWeek,
  );

  await deps.recurring.update(rule.id, {
    nextDueAt,
    lastInsertedAt: today,
  });
}