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
}
