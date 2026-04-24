import type { SQLiteDatabase } from 'expo-sqlite';

/** Stable IDs for default categories and tests */
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

