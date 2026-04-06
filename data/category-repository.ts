import * as Crypto from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import type { CategorySqlRow, CategoryWithUsageSqlRow, SqlCountRow, SqlMaxSortRow } from '@/types/sqlite-rows';
import type { Category, EntryType } from '@/types/finance';

export type CategoryWithUsage = Category & {
  transactionCount: number;
};

function mapRow(row: CategorySqlRow): Category {
  return {
    id: row.id,
    name: row.name,
    type: row.type,
    iconKey: row.icon_key,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
  };
}

export class CategoryRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listAll(): Promise<Category[]> {
    const rows = await this.db.getAllAsync<CategorySqlRow>(
      `SELECT id, name, type, icon_key, sort_order, created_at FROM categories
       ORDER BY sort_order ASC, name ASC`,
    );
    return rows.map(mapRow);
  }

  async listWithUsage(): Promise<CategoryWithUsage[]> {
    const rows = await this.db.getAllAsync<CategoryWithUsageSqlRow>(
      `SELECT c.id, c.name, c.type, c.icon_key, c.sort_order, c.created_at,
              COUNT(t.id) AS tx_count
       FROM categories c
       LEFT JOIN transactions t ON t.category_id = c.id
       GROUP BY c.id
       ORDER BY c.sort_order ASC, c.name ASC`,
    );
    return rows.map((r) => ({
      ...mapRow(r),
      transactionCount: r.tx_count,
    }));
  }

  async listByType(type: EntryType): Promise<Category[]> {
    const rows = await this.db.getAllAsync<CategorySqlRow>(
      `SELECT id, name, type, icon_key, sort_order, created_at FROM categories
       WHERE type = ?
       ORDER BY sort_order ASC, name ASC`,
      [type],
    );
    return rows.map(mapRow);
  }

  async getById(id: string): Promise<Category | null> {
    const row = await this.db.getFirstAsync<CategorySqlRow>(
      `SELECT id, name, type, icon_key, sort_order, created_at FROM categories WHERE id = ?`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  /** Case-insensitive name match within the same entry type (trimmed). */
  async findFirstByNameAndType(name: string, type: EntryType): Promise<Category | null> {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const row = await this.db.getFirstAsync<CategorySqlRow>(
      `SELECT id, name, type, icon_key, sort_order, created_at FROM categories
       WHERE type = ? AND LOWER(TRIM(name)) = LOWER(?)`,
      [type, trimmed],
    );
    return row ? mapRow(row) : null;
  }

  async countTransactions(categoryId: string): Promise<number> {
    const row = await this.db.getFirstAsync<SqlCountRow>(
      `SELECT COUNT(*) as c FROM transactions WHERE category_id = ?`,
      [categoryId],
    );
    return row?.c ?? 0;
  }

  async insert(input: { name: string; type: EntryType; iconKey: string }): Promise<string> {
    const id = await Crypto.randomUUID();
    const row = await this.db.getFirstAsync<SqlMaxSortRow>(
      `SELECT COALESCE(MAX(sort_order), 0) + 1 AS m FROM categories`,
    );
    const sortOrder = row?.m ?? 1;
    const createdAt = new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO categories (id, name, type, icon_key, sort_order, created_at) VALUES (?, ?, ?, ?, ?, ?)`,
      [id, input.name.trim(), input.type, input.iconKey, sortOrder, createdAt],
    );
    return id;
  }

  async update(
    id: string,
    patch: { name?: string; type?: EntryType; iconKey?: string },
  ): Promise<void> {
    const cur = await this.getById(id);
    if (!cur) return;
    await this.db.runAsync(
      `UPDATE categories SET name = ?, type = ?, icon_key = ? WHERE id = ?`,
      [
        patch.name !== undefined ? patch.name.trim() : cur.name,
        patch.type ?? cur.type,
        patch.iconKey ?? cur.iconKey,
        id,
      ],
    );
  }

  /** Deletes category and its budgets for this category. Fails if any transaction references it. */
  async deleteIfUnused(id: string): Promise<{ ok: true } | { ok: false; reason: 'in_use' }> {
    const n = await this.countTransactions(id);
    if (n > 0) return { ok: false, reason: 'in_use' };
    await this.db.runAsync(`DELETE FROM budgets WHERE category_id = ?`, [id]);
    await this.db.runAsync(`DELETE FROM categories WHERE id = ?`, [id]);
    return { ok: true };
  }
}
