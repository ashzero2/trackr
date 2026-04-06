import type { EntryType } from '@/types/finance';

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
