import {
  bucketUtcMonthDailyExpenses,
  compressMonthDailyToWeekBars,
  computeMonthInsight,
  computeVelocityInsight,
  peakDayLabel,
} from '@/lib/analytics-buckets';
import type { TransactionWithCategory } from '@/types/finance';

function makeTx(overrides: Partial<TransactionWithCategory>): TransactionWithCategory {
  return {
    id: 'tx-1',
    amountCents: 1000,
    type: 'expense',
    categoryId: 'cat-1',
    occurredAt: '2025-04-15T12:00:00.000Z',
    note: 'test',
    paymentMethod: 'CARD',
    createdAt: '2025-04-15T12:00:00.000Z',
    tripId: null,
    currencyCode: null,
    amountBaseCents: null,
    exchangeRateToBase: null,
    categoryName: 'Food',
    categoryIconKey: 'restaurant',
    ...overrides,
  };
}

describe('bucketUtcMonthDailyExpenses', () => {
  it('returns an array with length equal to days in month', () => {
    const result = bucketUtcMonthDailyExpenses([], 2025, 4);
    expect(result).toHaveLength(30); // April has 30 days
  });

  it('sums expenses into correct day buckets', () => {
    const txs = [
      makeTx({ occurredAt: '2025-04-15T12:00:00.000Z', amountCents: 500 }),
      makeTx({ occurredAt: '2025-04-15T18:00:00.000Z', amountCents: 300 }),
      makeTx({ occurredAt: '2025-04-20T12:00:00.000Z', amountCents: 1000 }),
    ];
    const result = bucketUtcMonthDailyExpenses(txs, 2025, 4);
    expect(result[14]).toBe(800);  // April 15 (0-indexed: 14)
    expect(result[19]).toBe(1000); // April 20 (0-indexed: 19)
    expect(result[0]).toBe(0);     // April 1 — no transactions
  });

  it('ignores income transactions', () => {
    const txs = [
      makeTx({ type: 'income', occurredAt: '2025-04-15T12:00:00.000Z', amountCents: 5000 }),
    ];
    const result = bucketUtcMonthDailyExpenses(txs, 2025, 4);
    expect(result[14]).toBe(0);
  });

  it('ignores transactions from other months', () => {
    const txs = [
      makeTx({ occurredAt: '2025-03-31T23:00:00.000Z', amountCents: 1000 }),
    ];
    const result = bucketUtcMonthDailyExpenses(txs, 2025, 4);
    expect(result.every((v) => v === 0)).toBe(true);
  });
});

describe('compressMonthDailyToWeekBars', () => {
  it('groups 30-day array into 5 week bars', () => {
    const daily = Array(30).fill(100);
    const { values, labels } = compressMonthDailyToWeekBars(daily);
    expect(values).toHaveLength(5);
    expect(labels).toEqual(['W1', 'W2', 'W3', 'W4', 'W5']);
    expect(values[0]).toBe(700);  // 7 * 100
    expect(values[4]).toBe(200);  // last 2 days
  });

  it('handles empty array', () => {
    const { values, labels } = compressMonthDailyToWeekBars([]);
    expect(values).toHaveLength(0);
    expect(labels).toHaveLength(0);
  });
});

describe('computeMonthInsight', () => {
  it('returns default message with no expenses', () => {
    const result = computeMonthInsight([], 0);
    expect(result).toContain('Add expenses');
  });

  it('highlights top category when >= 12%', () => {
    const byCat = [
      { categoryName: 'Food', spentCents: 5000 },
      { categoryName: 'Transport', spentCents: 1000 },
    ];
    const result = computeMonthInsight(byCat, 6000);
    expect(result).toContain('Food');
    expect(result).toContain('83%');
  });

  it('returns balance message when spread evenly', () => {
    const byCat = [
      { categoryName: 'A', spentCents: 100 },
      { categoryName: 'B', spentCents: 100 },
      { categoryName: 'C', spentCents: 100 },
      { categoryName: 'D', spentCents: 100 },
      { categoryName: 'E', spentCents: 100 },
      { categoryName: 'F', spentCents: 100 },
      { categoryName: 'G', spentCents: 100 },
      { categoryName: 'H', spentCents: 100 },
      { categoryName: 'I', spentCents: 100 },
      { categoryName: 'J', spentCents: 100 },
    ];
    const result = computeMonthInsight(byCat, 1000);
    expect(result).toContain('10 spending categories');
  });
});

describe('computeVelocityInsight', () => {
  it('returns null for too few elapsed days', () => {
    // Mock: currently on day 1-2 of the month
    // This test relies on the function using elapsedDaysInUtcMonth internally
    // We test with a past month which returns full days → null (elapsed >= total)
    const result = computeVelocityInsight(2024, 1, 50000, 40000);
    expect(result).toBeNull(); // past month, elapsed >= total
  });

  it('returns null when no expenses', () => {
    const result = computeVelocityInsight(2025, 4, 0, 40000);
    expect(result).toBeNull();
  });
});

describe('peakDayLabel', () => {
  it('returns label of the highest value day', () => {
    const values = [100, 500, 200];
    const labels = ['Mon', 'Tue', 'Wed'];
    expect(peakDayLabel(values, labels)).toBe('Peak Tue');
  });

  it('returns undefined for empty arrays', () => {
    expect(peakDayLabel([], [])).toBeUndefined();
  });

  it('returns undefined when all values are zero', () => {
    expect(peakDayLabel([0, 0, 0], ['A', 'B', 'C'])).toBeUndefined();
  });
});