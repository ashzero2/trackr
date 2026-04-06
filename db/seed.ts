import type { SQLiteDatabase } from 'expo-sqlite';

/** Stable IDs so demo rows and tests can reference categories */
export const SeedCategoryId = {
  groceries: 'seed-cat-groceries',
  dining: 'seed-cat-dining',
  transport: 'seed-cat-transport',
  housing: 'seed-cat-housing',
  entertainment: 'seed-cat-entertainment',
  shopping: 'seed-cat-shopping',
  incomeSalary: 'seed-cat-salary',
} as const;

const now = () => new Date().toISOString();

export async function seedCategories(db: SQLiteDatabase): Promise<void> {
  const rows: [string, string, string, string, number][] = [
    [SeedCategoryId.groceries, 'Groceries', 'expense', 'shopping-bag', 10],
    [SeedCategoryId.dining, 'Dining & Drinks', 'expense', 'local-cafe', 20],
    [SeedCategoryId.transport, 'Transport', 'expense', 'directions-car', 30],
    [SeedCategoryId.housing, 'Housing', 'expense', 'home', 40],
    [SeedCategoryId.entertainment, 'Entertainment', 'expense', 'subscriptions', 50],
    [SeedCategoryId.shopping, 'Shopping', 'expense', 'shopping-bag', 60],
    [SeedCategoryId.incomeSalary, 'Salary', 'income', 'account-balance-wallet', 5],
  ];

  const created = now();
  for (const [id, name, type, icon, order] of rows) {
    await db.runAsync(
      `INSERT OR IGNORE INTO categories (id, name, type, icon_key, sort_order, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, name, type, icon, order, created],
    );
  }
}

function utcIso(y: number, m0: number, day: number, h: number, min: number): string {
  return new Date(Date.UTC(y, m0, day, h, min, 0, 0)).toISOString();
}

/** Demo rows use the current calendar month so dashboard/history show data on first launch */
export async function seedDemoTransactionsIfEmpty(db: SQLiteDatabase): Promise<void> {
  const { cnt } = (await db.getFirstAsync<{ cnt: number }>(
    'SELECT COUNT(*) as cnt FROM transactions',
  )) ?? { cnt: 0 };
  if (cnt > 0) return;

  const t = now();
  const d = new Date();
  const y = d.getUTCFullYear();
  const m0 = d.getUTCMonth();
  const today = d.getUTCDate();
  const yesterday = Math.max(1, today - 1);

  const demo: [string, number, 'expense' | 'income', string, string, string | null, string][] = [
    ['seed-tx-1', 1240, 'expense', SeedCategoryId.dining, utcIso(y, m0, today, 9, 15), 'Blue Bottle Coffee', 'CASH'],
    ['seed-tx-2', 129900, 'expense', SeedCategoryId.shopping, utcIso(y, m0, today, 14, 30), 'Apple Store', 'VISA'],
    ['seed-tx-3', 2450, 'expense', SeedCategoryId.transport, utcIso(y, m0, yesterday, 20, 45), 'Uber', 'VISA'],
    ['seed-tx-4', 8412, 'expense', SeedCategoryId.groceries, utcIso(y, m0, yesterday, 17, 20), 'Whole Foods', 'VISA'],
    ['seed-tx-5', 640000, 'income', SeedCategoryId.incomeSalary, utcIso(y, m0, 1, 12, 0), 'Payroll', 'ACH'],
  ];

  for (const [id, amountCents, type, categoryId, occurredAt, note, payment] of demo) {
    await db.runAsync(
      `INSERT INTO transactions (id, amount_cents, type, category_id, occurred_at, note, payment_method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, amountCents, type, categoryId, occurredAt, note, payment, t],
    );
  }
}

export async function seedDemoBudgetsIfEmpty(db: SQLiteDatabase): Promise<void> {
  const { cnt } = (await db.getFirstAsync<{ cnt: number }>('SELECT COUNT(*) as cnt FROM budgets')) ?? {
    cnt: 0,
  };
  if (cnt > 0) return;

  const t = now();
  const nowD = new Date();
  const y = nowD.getUTCFullYear();
  const m = nowD.getUTCMonth() + 1;
  const budgets: [string | null, number][] = [
    [SeedCategoryId.dining, 60000],
    [SeedCategoryId.transport, 30000],
    [SeedCategoryId.groceries, 80000],
  ];

  for (const [categoryId, limitCents] of budgets) {
    const id = `seed-budget-${categoryId ?? 'overall'}-${y}-${m}`;
    await db.runAsync(
      `INSERT OR IGNORE INTO budgets (id, category_id, year, month, limit_cents, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [id, categoryId, y, m, limitCents, t],
    );
  }
}
