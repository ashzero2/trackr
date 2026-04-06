import type { SQLiteDatabase } from 'expo-sqlite';

const MIGRATION_V1 = `
CREATE TABLE IF NOT EXISTS categories (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  icon_key TEXT NOT NULL DEFAULT 'category',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS transactions (
  id TEXT PRIMARY KEY NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents >= 0),
  type TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  category_id TEXT NOT NULL,
  occurred_at TEXT NOT NULL,
  note TEXT,
  payment_method TEXT NOT NULL DEFAULT 'OTHER',
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_transactions_occurred ON transactions(occurred_at);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category_id);

CREATE TABLE IF NOT EXISTS budgets (
  id TEXT PRIMARY KEY NOT NULL,
  category_id TEXT,
  year INTEGER NOT NULL CHECK (year >= 2000 AND year <= 2100),
  month INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  limit_cents INTEGER NOT NULL CHECK (limit_cents >= 0),
  created_at TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS ux_budget_overall_month
  ON budgets(year, month) WHERE category_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS ux_budget_category_month
  ON budgets(category_id, year, month) WHERE category_id IS NOT NULL;
`;

export const CURRENT_SCHEMA_VERSION = 1;

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(MIGRATION_V1);
    await db.execAsync(`PRAGMA user_version = ${CURRENT_SCHEMA_VERSION}`);
    version = CURRENT_SCHEMA_VERSION;
  }
}
