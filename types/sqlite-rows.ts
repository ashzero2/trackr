import type { EntryType, TripStatus } from '@/types/finance';

/** `categories` table */
export type CategorySqlRow = {
  id: string;
  name: string;
  type: EntryType;
  icon_key: string;
  sort_order: number;
  created_at: string;
};

export type CategoryWithUsageSqlRow = CategorySqlRow & {
  tx_count: number;
};

/** `trips` table */
export type TripSqlRow = {
  id: string;
  name: string;
  start_at: string;
  end_at: string | null;
  status: TripStatus;
  created_at: string;
  metadata: string | null;
};

/** `trip_summaries` table */
export type TripSummarySqlRow = {
  trip_id: string;
  total_expense_cents: number;
  total_income_cents: number;
  txn_count: number;
  first_occurred_at: string | null;
  last_occurred_at: string | null;
  total_days: number;
  last_updated: string;
};

/** `transactions` table */
export type TransactionSqlRow = {
  id: string;
  amount_cents: number;
  type: EntryType;
  category_id: string;
  occurred_at: string;
  note: string | null;
  payment_method: string;
  created_at: string;
  trip_id: string | null;
  currency_code: string | null;
  amount_base_cents: number | null;
  exchange_rate_to_base: number | null;
};

export type TransactionWithCategorySqlRow = TransactionSqlRow & {
  category_name: string;
  category_icon_key: string;
};

/** `budgets` table */
export type BudgetSqlRow = {
  id: string;
  category_id: string | null;
  year: number;
  month: number;
  limit_cents: number;
  created_at: string;
};

/** `SELECT type, SUM(amount_cents) AS total ... GROUP BY type` */
export type MonthSummaryTypeTotalRow = {
  type: EntryType;
  total: number;
};

/** Spending by category for a month */
export type SpendingByCategorySqlRow = {
  category_id: string;
  name: string;
  spent: number;
};

export type SqlCountRow = { c: number };

export type SqlMaxSortRow = { m: number };
