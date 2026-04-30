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

export const CURRENT_SCHEMA_VERSION = 5;

const MIGRATION_V3_CREATE_TRIPS = `
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  start_at TEXT NOT NULL,
  end_at TEXT,
  status TEXT NOT NULL CHECK (status IN ('PLANNED', 'ACTIVE', 'COMPLETED', 'ARCHIVED')),
  created_at TEXT NOT NULL,
  metadata TEXT
);
`;

const MIGRATION_V3_CREATE_SUMMARIES = `
CREATE TABLE IF NOT EXISTS trip_summaries (
  trip_id TEXT PRIMARY KEY NOT NULL,
  total_expense_cents INTEGER NOT NULL DEFAULT 0,
  total_income_cents INTEGER NOT NULL DEFAULT 0,
  txn_count INTEGER NOT NULL DEFAULT 0,
  first_occurred_at TEXT,
  last_occurred_at TEXT,
  total_days INTEGER NOT NULL DEFAULT 1,
  last_updated TEXT NOT NULL,
  FOREIGN KEY (trip_id) REFERENCES trips(id) ON DELETE RESTRICT
);
`;

const MIGRATION_V4_RECURRING = `
CREATE TABLE IF NOT EXISTS recurring_transactions (
  id               TEXT PRIMARY KEY NOT NULL,
  title            TEXT NOT NULL,
  amount_cents     INTEGER NOT NULL CHECK (amount_cents > 0),
  type             TEXT NOT NULL CHECK (type IN ('expense', 'income')),
  category_id      TEXT NOT NULL,
  payment_method   TEXT NOT NULL DEFAULT 'OTHER',
  note             TEXT,
  currency_code    TEXT,
  frequency        TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  day_of_month     INTEGER CHECK (day_of_month IS NULL OR (day_of_month >= 1 AND day_of_month <= 31)),
  day_of_week      INTEGER CHECK (day_of_week IS NULL OR (day_of_week >= 0 AND day_of_week <= 6)),
  starts_at        TEXT NOT NULL,
  ends_at          TEXT,
  next_due_at      TEXT NOT NULL,
  auto_insert      INTEGER NOT NULL DEFAULT 0 CHECK (auto_insert IN (0, 1)),
  last_inserted_at TEXT,
  created_at       TEXT NOT NULL,
  FOREIGN KEY (category_id) REFERENCES categories(id) ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS idx_recurring_next_due ON recurring_transactions(next_due_at);
`;

async function runMigrationStep(
  db: SQLiteDatabase,
  targetVersion: number,
  migrationFn: () => Promise<void>,
): Promise<void> {
  await db.execAsync('BEGIN TRANSACTION');
  try {
    await migrationFn();
    await db.execAsync(`PRAGMA user_version = ${targetVersion}`);
    await db.execAsync('COMMIT');
  } catch (e) {
    await db.execAsync('ROLLBACK');
    throw e;
  }
}

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  await db.execAsync('PRAGMA foreign_keys = ON;');

  const row = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  let version = row?.user_version ?? 0;

  if (version < 1) {
    await runMigrationStep(db, 1, async () => {
      await db.execAsync(MIGRATION_V1);
    });
    version = 1;
  }

  if (version < 2) {
    await runMigrationStep(db, 2, async () => {
      await db.execAsync(`UPDATE transactions SET payment_method = 'CARD' WHERE payment_method = 'VISA'`);
    });
    version = 2;
  }

  if (version < 3) {
    await runMigrationStep(db, 3, async () => {
      await db.execAsync(MIGRATION_V3_CREATE_TRIPS);
      await db.execAsync(MIGRATION_V3_CREATE_SUMMARIES);
      await db.execAsync('ALTER TABLE transactions ADD COLUMN trip_id TEXT');
      await db.execAsync('ALTER TABLE transactions ADD COLUMN currency_code TEXT');
      await db.execAsync('ALTER TABLE transactions ADD COLUMN amount_base_cents INTEGER');
      await db.execAsync('ALTER TABLE transactions ADD COLUMN exchange_rate_to_base REAL');
      await db.execAsync('CREATE INDEX IF NOT EXISTS idx_transactions_trip_id ON transactions(trip_id)');
      await db.execAsync(
        'CREATE INDEX IF NOT EXISTS idx_transactions_trip_occurred ON transactions(trip_id, occurred_at)',
      );
      await db.execAsync(
        `UPDATE transactions SET amount_base_cents = amount_cents, exchange_rate_to_base = 1.0 WHERE amount_base_cents IS NULL`,
      );
    });
    version = 3;
  }

  if (version < 4) {
    await runMigrationStep(db, 4, async () => {
      await db.execAsync(MIGRATION_V4_RECURRING);
    });
    version = 4;
  }

  if (version < 5) {
    await runMigrationStep(db, 5, async () => {
      await db.execAsync(`ALTER TABLE budgets ADD COLUMN period TEXT NOT NULL DEFAULT 'monthly'`);
    });
    version = 5;
  }
}
