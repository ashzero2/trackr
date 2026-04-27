import type { SQLiteDatabase } from 'expo-sqlite';

import type { TripRepository } from '@/data/trip-repository';
import { monthRangeUtc } from '@/lib/dates';
import { parsePaymentMethod } from '@/lib/payment-method';
import type {
  MonthSummaryTypeTotalRow,
  SpendingByCategorySqlRow,
  TransactionSqlRow,
  TransactionWithCategorySqlRow,
} from '@/types/sqlite-rows';
import type { MonthSummary, Transaction, TransactionWithCategory } from '@/types/finance';

const TX_SELECT = `t.id, t.amount_cents, t.type, t.category_id, t.occurred_at, t.note, t.payment_method, t.created_at,
  t.trip_id, t.currency_code, t.amount_base_cents, t.exchange_rate_to_base`;

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
    tripId: row.trip_id ?? null,
    currencyCode: row.currency_code ?? null,
    amountBaseCents: row.amount_base_cents ?? null,
    exchangeRateToBase: row.exchange_rate_to_base ?? null,
  };
}

function mapTxJoin(row: TransactionWithCategorySqlRow): TransactionWithCategory {
  return {
    ...mapTx(row),
    categoryName: row.category_name,
    categoryIconKey: row.category_icon_key,
  };
}

function recomputeTrips(trips: TripRepository, ids: (string | null | undefined)[]): Promise<void> {
  const unique = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  return Promise.all(unique.map((id) => trips.recomputeTripSummary(id))).then(() => undefined);
}

export class TransactionRepository {
  constructor(
    private readonly db: SQLiteDatabase,
    private readonly trips: TripRepository,
    private readonly onWrite?: () => void,
  ) {}

  async listByMonth(year: number, month: number): Promise<TransactionWithCategory[]> {
    const { start, end } = monthRangeUtc(year, month);
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT ${TX_SELECT},
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.occurred_at >= ? AND t.occurred_at < ?
       ORDER BY t.occurred_at DESC`,
      [start, end],
    );
    return rows.map(mapTxJoin);
  }

  async listByMonthWithoutTrip(year: number, month: number): Promise<TransactionWithCategory[]> {
    const { start, end } = monthRangeUtc(year, month);
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT ${TX_SELECT},
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.trip_id IS NULL
       ORDER BY t.occurred_at DESC`,
      [start, end],
    );
    return rows.map(mapTxJoin);
  }

  async listByTripAndMonth(tripId: string, year: number, month: number): Promise<TransactionWithCategory[]> {
    const { start, end } = monthRangeUtc(year, month);
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT ${TX_SELECT},
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.trip_id = ? AND t.occurred_at >= ? AND t.occurred_at < ?
       ORDER BY t.occurred_at DESC`,
      [tripId, start, end],
    );
    return rows.map(mapTxJoin);
  }

  async listForTripAllTime(tripId: string): Promise<TransactionWithCategory[]> {
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT ${TX_SELECT},
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.trip_id = ?
       ORDER BY t.occurred_at DESC`,
      [tripId],
    );
    return rows.map(mapTxJoin);
  }

  async listRecent(limit: number): Promise<TransactionWithCategory[]> {
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT ${TX_SELECT},
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
      `SELECT ${TX_SELECT},
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

  async insert(
    input: Omit<Transaction, 'createdAt'> & { createdAt?: string },
    options?: { skipOuterTransaction?: boolean },
  ): Promise<void> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    const body = async () => {
      await this.db.runAsync(
        `INSERT INTO transactions (
          id, amount_cents, type, category_id, occurred_at, note, payment_method, created_at,
          trip_id, currency_code, amount_base_cents, exchange_rate_to_base
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          input.id,
          input.amountCents,
          input.type,
          input.categoryId,
          input.occurredAt,
          input.note,
          input.paymentMethod,
          createdAt,
          input.tripId,
          input.currencyCode,
          input.amountBaseCents,
          input.exchangeRateToBase,
        ],
      );
      if (input.tripId) {
        await this.trips.recomputeTripSummary(input.tripId);
      }
    };
    if (options?.skipOuterTransaction) {
      await body();
    } else {
      await this.db.withTransactionAsync(body);
    }
    this.onWrite?.();
  }

  async update(
    id: string,
    patch: Partial<
      Pick<
        Transaction,
        | 'amountCents'
        | 'type'
        | 'categoryId'
        | 'occurredAt'
        | 'note'
        | 'paymentMethod'
        | 'currencyCode'
        | 'amountBaseCents'
        | 'exchangeRateToBase'
      >
    > & { tripId?: string | null },
  ): Promise<void> {
    const current = await this.db.getFirstAsync<TransactionSqlRow>(
      `SELECT ${TX_SELECT} FROM transactions t WHERE t.id = ?`,
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
      trip_id: patch.tripId !== undefined ? patch.tripId : current.trip_id,
      currency_code: patch.currencyCode !== undefined ? patch.currencyCode : current.currency_code,
      amount_base_cents:
        patch.amountBaseCents !== undefined ? patch.amountBaseCents : current.amount_base_cents,
      exchange_rate_to_base:
        patch.exchangeRateToBase !== undefined ? patch.exchangeRateToBase : current.exchange_rate_to_base,
    };

    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(
        `UPDATE transactions SET amount_cents = ?, type = ?, category_id = ?, occurred_at = ?, note = ?, payment_method = ?,
          trip_id = ?, currency_code = ?, amount_base_cents = ?, exchange_rate_to_base = ?
         WHERE id = ?`,
        [
          next.amount_cents,
          next.type,
          next.category_id,
          next.occurred_at,
          next.note,
          next.payment_method,
          next.trip_id,
          next.currency_code,
          next.amount_base_cents,
          next.exchange_rate_to_base,
          id,
        ],
      );
      const toRecompute = new Set<string>();
      if (current.trip_id) toRecompute.add(current.trip_id);
      if (next.trip_id) toRecompute.add(next.trip_id);
      await recomputeTrips(this.trips, [...toRecompute]);
    });
    this.onWrite?.();
  }

  async delete(id: string): Promise<void> {
    const current = await this.db.getFirstAsync<Pick<TransactionSqlRow, 'trip_id'>>(
      `SELECT trip_id FROM transactions WHERE id = ?`,
      [id],
    );
    await this.db.withTransactionAsync(async () => {
      await this.db.runAsync(`DELETE FROM transactions WHERE id = ?`, [id]);
      if (current?.trip_id) {
        await this.trips.recomputeTripSummary(current.trip_id);
      }
    });
    this.onWrite?.();
  }

  async deleteAll(): Promise<void> {
    await this.db.runAsync(`DELETE FROM transactions`);
    await this.trips.recomputeAllTripSummaries();
  }

  async listAllWithCategory(): Promise<TransactionWithCategory[]> {
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT ${TX_SELECT},
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       ORDER BY t.occurred_at DESC`,
    );
    return rows.map(mapTxJoin);
  }

  async listExpensesBetween(startIso: string, endIso: string): Promise<TransactionWithCategory[]> {
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT ${TX_SELECT},
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.occurred_at >= ? AND t.occurred_at < ? AND t.type = 'expense'
       ORDER BY t.occurred_at ASC`,
      [startIso, endIso],
    );
    return rows.map(mapTxJoin);
  }

  /** All transaction types between [startIso, endIso), newest first, capped. */
  async listBetween(startIso: string, endIso: string, limit: number): Promise<TransactionWithCategory[]> {
    const cap = Math.min(Math.max(1, limit), 200);
    const rows = await this.db.getAllAsync<TransactionWithCategorySqlRow>(
      `SELECT ${TX_SELECT},
              c.name AS category_name, c.icon_key AS category_icon_key
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.occurred_at >= ? AND t.occurred_at < ?
       ORDER BY t.occurred_at DESC
       LIMIT ?`,
      [startIso, endIso, cap],
    );
    return rows.map(mapTxJoin);
  }

  /** Sum of base-currency expense cents for trip on local calendar day of `dayStart` (midnight local). */
  async sumTripExpenseOnLocalDay(tripId: string, localDayStart: Date, localDayEndExclusive: Date): Promise<number> {
    const row = await this.db.getFirstAsync<{ s: number | null }>(
      `SELECT SUM(COALESCE(amount_base_cents, amount_cents)) AS s FROM transactions
       WHERE trip_id = ? AND type = 'expense'
       AND occurred_at >= ? AND occurred_at < ?`,
      [tripId, localDayStart.toISOString(), localDayEndExclusive.toISOString()],
    );
    return Math.round(Number(row?.s ?? 0));
  }
}
