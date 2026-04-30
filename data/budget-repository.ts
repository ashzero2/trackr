import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { BudgetSqlRow } from '@/types/sqlite-rows';
import type { Budget, BudgetPeriod } from '@/types/finance';

function mapRow(row: BudgetSqlRow): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    year: row.year,
    month: row.month,
    limitCents: row.limit_cents,
    period: (row.period as BudgetPeriod) ?? 'monthly',
    createdAt: row.created_at,
  };
}

export class BudgetRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listForMonth(year: number, month: number): Promise<Budget[]> {
    const rows = await this.db.getAllAsync<BudgetSqlRow>(
      `SELECT id, category_id, year, month, limit_cents, period, created_at FROM budgets
       WHERE year = ? AND month = ?
       ORDER BY category_id IS NULL DESC, category_id ASC`,
      [year, month],
    );
    return rows.map(mapRow);
  }

  async getForCategory(
    categoryId: string | null,
    year: number,
    month: number,
  ): Promise<Budget | null> {
    const row =
      categoryId === null
        ? await this.db.getFirstAsync<BudgetSqlRow>(
            `SELECT id, category_id, year, month, limit_cents, period, created_at FROM budgets
             WHERE year = ? AND month = ? AND category_id IS NULL`,
            [year, month],
          )
        : await this.db.getFirstAsync<BudgetSqlRow>(
            `SELECT id, category_id, year, month, limit_cents, period, created_at FROM budgets
             WHERE year = ? AND month = ? AND category_id = ?`,
            [year, month, categoryId],
          );
    return row ? mapRow(row) : null;
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM budgets WHERE id = ?`, [id]);
  }

  /**
   * Create or update limit for this month + category (null category = overall).
   */
  async upsert(input: {
    categoryId: string | null;
    year: number;
    month: number;
    limitCents: number;
    period?: BudgetPeriod;
  }): Promise<string> {
    const period = input.period ?? 'monthly';
    const existing = await this.getForCategory(input.categoryId, input.year, input.month);
    if (existing) {
      await this.db.runAsync(`UPDATE budgets SET limit_cents = ?, period = ? WHERE id = ?`, [
        input.limitCents,
        period,
        existing.id,
      ]);
      return existing.id;
    }
    const id = await Crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO budgets (id, category_id, year, month, limit_cents, period, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [id, input.categoryId, input.year, input.month, input.limitCents, period, createdAt],
    );
    return id;
  }

  /** List weekly budgets whose month context falls in the given date range. */
  async listForWeek(year: number, month: number): Promise<Budget[]> {
    const rows = await this.db.getAllAsync<BudgetSqlRow>(
      `SELECT id, category_id, year, month, limit_cents, period, created_at FROM budgets
       WHERE year = ? AND month = ? AND period = 'weekly'
       ORDER BY category_id IS NULL DESC, category_id ASC`,
      [year, month],
    );
    return rows.map(mapRow);
  }

  /** List yearly budgets for a given year. */
  async listForYear(year: number): Promise<Budget[]> {
    const rows = await this.db.getAllAsync<BudgetSqlRow>(
      `SELECT id, category_id, year, month, limit_cents, period, created_at FROM budgets
       WHERE year = ? AND period = 'yearly'
       ORDER BY category_id IS NULL DESC, category_id ASC`,
      [year],
    );
    return rows.map(mapRow);
  }

  /**
   * Return the last N months' budget limit and actual spending for a category.
   * Useful for showing budget history/trend per category.
   */
  async listHistoryForCategory(
    categoryId: string,
    count: number,
  ): Promise<{ year: number; month: number; limitCents: number; spentCents: number }[]> {
    const now = new Date();
    const results: { year: number; month: number; limitCents: number; spentCents: number }[] = [];
    for (let i = count - 1; i >= 0; i--) {
      const d = new Date(now.getUTCFullYear(), now.getUTCMonth() - i, 1);
      const y = d.getFullYear();
      const m = d.getMonth() + 1;
      const budgetRow = await this.db.getFirstAsync<{ limit_cents: number }>(
        `SELECT limit_cents FROM budgets WHERE category_id = ? AND year = ? AND month = ?`,
        [categoryId, y, m],
      );
      const spentRow = await this.db.getFirstAsync<{ s: number | null }>(
        `SELECT SUM(t.amount_cents) AS s FROM transactions t
         WHERE t.category_id = ? AND t.type = 'expense'
         AND t.occurred_at >= ? AND t.occurred_at < ?`,
        [
          categoryId,
          `${y}-${String(m).padStart(2, '0')}-01T00:00:00.000Z`,
          m === 12
            ? `${y + 1}-01-01T00:00:00.000Z`
            : `${y}-${String(m + 1).padStart(2, '0')}-01T00:00:00.000Z`,
        ],
      );
      results.push({
        year: y,
        month: m,
        limitCents: budgetRow?.limit_cents ?? 0,
        spentCents: Math.round(Number(spentRow?.s ?? 0)),
      });
    }
    return results;
  }
}
