import type { SQLiteDatabase } from 'expo-sqlite';

import { parsePaymentMethod } from '@/lib/payment-method';
import type {
  MonthSummaryTypeTotalRow,
  SpendingByCategorySqlRow,
  TransactionSqlRow,
  TransactionWithCategorySqlRow,
} from '@/types/sqlite-rows';
import type { EntryType, MonthSummary, Transaction, TransactionWithCategory } from '@/types/finance';

function monthRangeUtc(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function mapTx(row: TransactionSqlRow): Transaction {
  return {
    id: row.id,
    amountCents: row.amount_cents,
    type: row.type,
    categoryId: row.category_id,
    occurredAt: row.occurred_at,
    note: row.note,
    paymentMethod: parsePaymentMethod(row.payment_method),
    createdAt: row.created_at,
  };
}

function mapTxJoin(row: TransactionWithCategorySqlRow): TransactionWithCategory {
  return {
    ...mapTx(row),
    categoryName: row.category_name,
    categoryIconKey: row.category_icon_key,
  };
}

export class TransactionRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listByMonth(year: number, month: number): Promise<TransactionWithCategory[]> {
    const { start, end } = monthRangeUtc(year, month);
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT t.id, t.amount_cents, t.type, t.category_id, t.occurred_at, t.note, t.payment_method, t.created_at,
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.occurred_at >= ? AND t.occurred_at < ?
       ORDER BY t.occurred_at DESC`,
      [start, end],
    );
    return rows.map(mapTxJoin);
  }

  async listRecent(limit: number): Promise<TransactionWithCategory[]> {
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT t.id, t.amount_cents, t.type, t.category_id, t.occurred_at, t.note, t.payment_method, t.created_at,
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       ORDER BY t.occurred_at DESC
       LIMIT ?`,
      [limit],
    );
    return rows.map(mapTxJoin);
  }

  async getById(id: string): Promise<TransactionWithCategory | null> {
    const row = await this.db.getFirstAsync<TransactionWithCategorySqlRow>(
      `SELECT t.id, t.amount_cents, t.type, t.category_id, t.occurred_at, t.note, t.payment_method, t.created_at,
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.id = ?`,
      [id],
    );
    return row ? mapTxJoin(row) : null;
  }

  async summaryForMonth(year: number, month: number): Promise<MonthSummary> {
    const { start, end } = monthRangeUtc(year, month);
    const rows = await this.db.getAllAsync<MonthSummaryTypeTotalRow>(
      `SELECT type, SUM(amount_cents) as total FROM transactions
       WHERE occurred_at >= ? AND occurred_at < ?
       GROUP BY type`,
      [start, end],
    );
    let totalExpenseCents = 0;
    let totalIncomeCents = 0;
    for (const r of rows) {
      if (r.type === 'expense') totalExpenseCents = r.total;
      if (r.type === 'income') totalIncomeCents = r.total;
    }
    return { totalExpenseCents, totalIncomeCents };
  }

  async spendingByCategoryForMonth(
    year: number,
    month: number,
  ): Promise<{ categoryId: string; categoryName: string; spentCents: number }[]> {
    const { start, end } = monthRangeUtc(year, month);
    const rows = await this.db.getAllAsync<SpendingByCategorySqlRow>(
      `SELECT t.category_id, c.name, SUM(t.amount_cents) as spent
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.type = 'expense'
       GROUP BY t.category_id
       ORDER BY spent DESC`,
      [start, end],
    );
    return rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.name,
      spentCents: r.spent,
    }));
  }

  async insert(input: Omit<Transaction, 'createdAt'> & { createdAt?: string }): Promise<void> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO transactions (id, amount_cents, type, category_id, occurred_at, note, payment_method, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        input.id,
        input.amountCents,
        input.type,
        input.categoryId,
        input.occurredAt,
        input.note,
        input.paymentMethod,
        createdAt,
      ],
    );
  }

  async update(
    id: string,
    patch: Partial<
      Pick<Transaction, 'amountCents' | 'type' | 'categoryId' | 'occurredAt' | 'note' | 'paymentMethod'>
    >,
  ): Promise<void> {
    const current = await this.db.getFirstAsync<TransactionSqlRow>(
      `SELECT id, amount_cents, type, category_id, occurred_at, note, payment_method, created_at FROM transactions WHERE id = ?`,
      [id],
    );
    if (!current) return;

    const next = {
      amount_cents: patch.amountCents ?? current.amount_cents,
      type: patch.type ?? current.type,
      category_id: patch.categoryId ?? current.category_id,
      occurred_at: patch.occurredAt ?? current.occurred_at,
      note: patch.note !== undefined ? patch.note : current.note,
      payment_method: patch.paymentMethod ?? current.payment_method,
    };

    await this.db.runAsync(
      `UPDATE transactions SET amount_cents = ?, type = ?, category_id = ?, occurred_at = ?, note = ?, payment_method = ?
       WHERE id = ?`,
      [
        next.amount_cents,
        next.type,
        next.category_id,
        next.occurred_at,
        next.note,
        next.payment_method,
        id,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
  }

  async deleteAll(): Promise<void> {
    await this.db.runAsync(`DELETE FROM transactions`);
  }

  async listAllWithCategory(): Promise<TransactionWithCategory[]> {
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT t.id, t.amount_cents, t.type, t.category_id, t.occurred_at, t.note, t.payment_method, t.created_at,
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       ORDER BY t.occurred_at DESC`,
    );
    return rows.map(mapTxJoin);
  }

  /** Expense rows in [start, end) ISO range for analytics */
  async listExpensesBetween(startIso: string, endIso: string): Promise<TransactionWithCategory[]> {
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT t.id, t.amount_cents, t.type, t.category_id, t.occurred_at, t.note, t.payment_method, t.created_at,
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.type = 'expense'
       ORDER BY t.occurred_at ASC`,
      [startIso, endIso],
    );
    return rows.map(mapTxJoin);
  }
}
