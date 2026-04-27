import type { SQLiteDatabase } from 'expo-sqlite';

import { parsePaymentMethod } from '@/lib/payment-method';
import type { RecurrenceFrequency, RecurringTransaction } from '@/types/finance';

type RecurringRow = {
  id: string;
  title: string;
  amount_cents: number;
  type: string;
  category_id: string;
  payment_method: string;
  note: string | null;
  currency_code: string | null;
  frequency: string;
  day_of_month: number | null;
  day_of_week: number | null;
  starts_at: string;
  ends_at: string | null;
  next_due_at: string;
  auto_insert: number;
  last_inserted_at: string | null;
  created_at: string;
};

function mapRow(r: RecurringRow): RecurringTransaction {
  return {
    id: r.id,
    title: r.title,
    amountCents: r.amount_cents,
    type: r.type as RecurringTransaction['type'],
    categoryId: r.category_id,
    paymentMethod: parsePaymentMethod(r.payment_method),
    note: r.note,
    currencyCode: r.currency_code,
    frequency: r.frequency as RecurrenceFrequency,
    dayOfMonth: r.day_of_month,
    dayOfWeek: r.day_of_week,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    nextDueAt: r.next_due_at,
    autoInsert: r.auto_insert === 1,
    lastInsertedAt: r.last_inserted_at,
    createdAt: r.created_at,
  };
}

export class RecurringRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async listAll(): Promise<RecurringTransaction[]> {
    const rows = await this.db.getAllAsync<RecurringRow>(
      `SELECT * FROM recurring_transactions ORDER BY next_due_at ASC`,
    );
    return rows.map(mapRow);
  }

  /**
   * Returns rules where `next_due_at <= today` and either `ends_at` is null
   * or `ends_at >= today` (still within the active window).
   */
  async listDue(todayIso: string): Promise<RecurringTransaction[]> {
    const rows = await this.db.getAllAsync<RecurringRow>(
      `SELECT * FROM recurring_transactions
       WHERE next_due_at <= ?
         AND (ends_at IS NULL OR ends_at >= ?)
       ORDER BY next_due_at ASC`,
      [todayIso, todayIso],
    );
    return rows.map(mapRow);
  }

  async getById(id: string): Promise<RecurringTransaction | null> {
    const row = await this.db.getFirstAsync<RecurringRow>(
      `SELECT * FROM recurring_transactions WHERE id = ?`,
      [id],
    );
    return row ? mapRow(row) : null;
  }

  async insert(rule: RecurringTransaction): Promise<void> {
    await this.db.runAsync(
      `INSERT INTO recurring_transactions (
        id, title, amount_cents, type, category_id, payment_method, note, currency_code,
        frequency, day_of_month, day_of_week, starts_at, ends_at, next_due_at,
        auto_insert, last_inserted_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        rule.id,
        rule.title,
        rule.amountCents,
        rule.type,
        rule.categoryId,
        rule.paymentMethod,
        rule.note,
        rule.currencyCode,
        rule.frequency,
        rule.dayOfMonth,
        rule.dayOfWeek,
        rule.startsAt,
        rule.endsAt,
        rule.nextDueAt,
        rule.autoInsert ? 1 : 0,
        rule.lastInsertedAt,
        rule.createdAt,
      ],
    );
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        RecurringTransaction,
        | 'title'
        | 'amountCents'
        | 'type'
        | 'categoryId'
        | 'paymentMethod'
        | 'note'
        | 'currencyCode'
        | 'frequency'
        | 'dayOfMonth'
        | 'dayOfWeek'
        | 'startsAt'
        | 'endsAt'
        | 'nextDueAt'
        | 'autoInsert'
        | 'lastInsertedAt'
      >
    >,
  ): Promise<void> {
    const current = await this.db.getFirstAsync<RecurringRow>(
      `SELECT * FROM recurring_transactions WHERE id = ?`,
      [id],
    );
    if (!current) return;

    await this.db.runAsync(
      `UPDATE recurring_transactions SET
        title = ?, amount_cents = ?, type = ?, category_id = ?, payment_method = ?,
        note = ?, currency_code = ?, frequency = ?, day_of_month = ?, day_of_week = ?,
        starts_at = ?, ends_at = ?, next_due_at = ?, auto_insert = ?, last_inserted_at = ?
       WHERE id = ?`,
      [
        patch.title ?? current.title,
        patch.amountCents ?? current.amount_cents,
        patch.type ?? current.type,
        patch.categoryId ?? current.category_id,
        patch.paymentMethod ?? current.payment_method,
        patch.note !== undefined ? patch.note : current.note,
        patch.currencyCode !== undefined ? patch.currencyCode : current.currency_code,
        patch.frequency ?? current.frequency,
        patch.dayOfMonth !== undefined ? patch.dayOfMonth : current.day_of_month,
        patch.dayOfWeek !== undefined ? patch.dayOfWeek : current.day_of_week,
        patch.startsAt ?? current.starts_at,
        patch.endsAt !== undefined ? patch.endsAt : current.ends_at,
        patch.nextDueAt ?? current.next_due_at,
        patch.autoInsert !== undefined ? (patch.autoInsert ? 1 : 0) : current.auto_insert,
        patch.lastInsertedAt !== undefined ? patch.lastInsertedAt : current.last_inserted_at,
        id,
      ],
    );
  }

  async delete(id: string): Promise<void> {
    await this.db.runAsync(`DELETE FROM recurring_transactions WHERE id = ?`, [id]);
  }
}