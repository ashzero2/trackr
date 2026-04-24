import { parseIsoToLocalDayKey } from '@/lib/dates';
import type { TransactionWithCategory } from '@/types/finance';

export function groupByLocalDay(
  items: TransactionWithCategory[],
): { dayKey: string; items: TransactionWithCategory[] }[] {
  const map = new Map<string, TransactionWithCategory[]>();
  for (const t of items) {
    const k = parseIsoToLocalDayKey(t.occurredAt);
    if (!map.has(k)) map.set(k, []);
    map.get(k)!.push(t);
  }
  const keys = [...map.keys()].sort((a, b) => (a > b ? -1 : 1));
  return keys.map((dayKey) => ({ dayKey, items: map.get(dayKey)! }));
}

export function dayExpenseTotal(items: TransactionWithCategory[]): number {
  return items.filter((t) => t.type === 'expense').reduce((s, t) => s + t.amountCents, 0);
}
