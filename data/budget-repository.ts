import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { BudgetSqlRow } from '@/types/sqlite-rows';
import type { Budget } from '@/types/finance';

function mapRow(row: BudgetSqlRow): Budget {
  return {
    id: row.id,
    categoryId: row.category_id,
    year: row.year,
    month: row.month,
    limitCents: row.limit_cents,
    createdAt: row.created_at,
  };
}

export class BudgetRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listForMonth(year: number, month: number): Promise<Budget[]> {
    const rows = await this.db.getAllAsync<BudgetSqlRow>(
      `SELECT id, category_id, year, month, limit_cents, created_at FROM budgets
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
            `SELECT id, category_id, year, month, limit_cents, created_at FROM budgets
             WHERE year = ? AND month = ? AND category_id IS NULL`,
            [year, month],
          )
        : await this.db.getFirstAsync<BudgetSqlRow>(
            `SELECT id, category_id, year, month, limit_cents, created_at FROM budgets
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
  }): Promise<string> {
    const existing = await this.getForCategory(input.categoryId, input.year, input.month);
    if (existing) {
      await this.db.runAsync(`UPDATE budgets SET limit_cents = ? WHERE id = ?`, [
        input.limitCents,
        existing.id,
      ]);
      return existing.id;
    }
    const id = await Crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO budgets (id, category_id, year, month, limit_cents, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.categoryId, input.year, input.month, input.limitCents, createdAt],
    );
    return id;
  }
}
