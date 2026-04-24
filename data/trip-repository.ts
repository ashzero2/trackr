import type { SQLiteDatabase } from 'expo-sqlite';

import type { Trip, TripMonthActivity, TripStatus, TripSummary } from '@/types/finance';
import type { TripSqlRow, TripSummarySqlRow } from '@/types/sqlite-rows';

function monthRangeUtc(year: number, month: number): { start: string; end: string } {
  const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0));
  return { start: start.toISOString(), end: end.toISOString() };
}

function mapTrip(row: TripSqlRow): Trip {
  return {
    id: row.id,
    name: row.name,
    startAt: row.start_at,
    endAt: row.end_at,
    status: row.status,
    createdAt: row.created_at,
    metadata: row.metadata,
  };
}

function mapSummary(row: TripSummarySqlRow): TripSummary {
  return {
    tripId: row.trip_id,
    totalExpenseCents: row.total_expense_cents,
    totalIncomeCents: row.total_income_cents,
    txnCount: row.txn_count,
    firstOccurredAt: row.first_occurred_at,
    lastOccurredAt: row.last_occurred_at,
    totalDays: row.total_days,
    lastUpdated: row.last_updated,
  };
}

function inclusiveDaySpan(firstIso: string, lastIso: string): number {
  const a = new Date(firstIso).getTime();
  const b = new Date(lastIso).getTime();
  if (!Number.isFinite(a) || !Number.isFinite(b)) return 1;
  const diff = Math.max(0, b - a);
  return Math.max(1, Math.floor(diff / 86400000) + 1);
}

export class TripRepository {
  constructor(private readonly db: SQLiteDatabase) {}

  async getById(id: string): Promise<Trip | null> {
    const row = await this.db.getFirstAsync<TripSqlRow>(`SELECT * FROM trips WHERE id = ?`, [id]);
    return row ? mapTrip(row) : null;
  }

  async listAll(): Promise<Trip[]> {
    const rows = await this.db.getAllAsync<TripSqlRow>(
      `SELECT * FROM trips ORDER BY datetime(start_at) DESC, created_at DESC`,
    );
    return rows.map(mapTrip);
  }

  async insert(input: Omit<Trip, 'createdAt'> & { createdAt?: string }): Promise<void> {
    const createdAt = input.createdAt ?? new Date().toISOString();
    await this.db.runAsync(
      `INSERT INTO trips (id, name, start_at, end_at, status, created_at, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [input.id, input.name, input.startAt, input.endAt, input.status, createdAt, input.metadata],
    );
    if (input.status === 'ACTIVE') {
      await this.demoteOtherActiveTrips(input.id);
    }
  }

  async update(
    id: string,
    patch: Partial<Pick<Trip, 'name' | 'startAt' | 'endAt' | 'status' | 'metadata'>>,
  ): Promise<void> {
    const cur = await this.getById(id);
    if (!cur) return;
    const next = {
      name: patch.name ?? cur.name,
      startAt: patch.startAt ?? cur.startAt,
      endAt: patch.endAt !== undefined ? patch.endAt : cur.endAt,
      status: patch.status ?? cur.status,
      metadata: patch.metadata !== undefined ? patch.metadata : cur.metadata,
    };
    await this.db.runAsync(
      `UPDATE trips SET name = ?, start_at = ?, end_at = ?, status = ?, metadata = ? WHERE id = ?`,
      [next.name, next.startAt, next.endAt, next.status, next.metadata, id],
    );
  }

  async demoteOtherActiveTrips(keepId: string): Promise<void> {
    await this.db.runAsync(`UPDATE trips SET status = 'PLANNED' WHERE status = 'ACTIVE' AND id != ?`, [keepId]);
  }

  async setStatus(id: string, status: TripStatus): Promise<void> {
    if (status === 'ACTIVE') {
      await this.demoteOtherActiveTrips(id);
    }
    await this.db.runAsync(`UPDATE trips SET status = ? WHERE id = ?`, [status, id]);
  }

  async recomputeTripSummary(tripId: string): Promise<void> {
    const now = new Date().toISOString();
    const agg = await this.db.getFirstAsync<{
      expense: number | null;
      income: number | null;
      c: number | null;
      first: string | null;
      last: string | null;
    }>(
      `SELECT
        SUM(CASE WHEN type = 'expense' THEN COALESCE(amount_base_cents, amount_cents) ELSE 0 END) AS expense,
        SUM(CASE WHEN type = 'income' THEN COALESCE(amount_base_cents, amount_cents) ELSE 0 END) AS income,
        COUNT(*) AS c,
        MIN(occurred_at) AS first,
        MAX(occurred_at) AS last
       FROM transactions WHERE trip_id = ?`,
      [tripId],
    );
    const count = agg?.c ?? 0;
    if (count === 0) {
      await this.db.runAsync(`DELETE FROM trip_summaries WHERE trip_id = ?`, [tripId]);
      return;
    }
    const expense = Math.round(Number(agg?.expense ?? 0));
    const income = Math.round(Number(agg?.income ?? 0));
    const first = agg?.first ?? null;
    const last = agg?.last ?? null;
    const totalDays = first && last ? inclusiveDaySpan(first, last) : 1;
    await this.db.runAsync(
      `INSERT OR REPLACE INTO trip_summaries (
        trip_id, total_expense_cents, total_income_cents, txn_count,
        first_occurred_at, last_occurred_at, total_days, last_updated
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [tripId, expense, income, count, first, last, totalDays, now],
    );
  }

  async recomputeAllTripSummaries(): Promise<void> {
    const trips = await this.db.getAllAsync<{ id: string }>(`SELECT id FROM trips`);
    for (const t of trips) {
      await this.recomputeTripSummary(t.id);
    }
  }

  async getSummary(tripId: string): Promise<TripSummary | null> {
    const row = await this.db.getFirstAsync<TripSummarySqlRow>(
      `SELECT * FROM trip_summaries WHERE trip_id = ?`,
      [tripId],
    );
    return row ? mapSummary(row) : null;
  }

  async listTripsWithActivityInMonth(year: number, month: number): Promise<TripMonthActivity[]> {
    const { start, end } = monthRangeUtc(year, month);
    const rows = await this.db.getAllAsync<
      TripSqlRow & {
        month_expense_cents: number;
        month_income_cents: number;
        month_txn_count: number;
      }
    >(
      `SELECT t.id, t.name, t.start_at, t.end_at, t.status, t.created_at, t.metadata,
        COALESCE(SUM(CASE WHEN tr.type = 'expense' THEN COALESCE(tr.amount_base_cents, tr.amount_cents) ELSE 0 END), 0) AS month_expense_cents,
        COALESCE(SUM(CASE WHEN tr.type = 'income' THEN COALESCE(tr.amount_base_cents, tr.amount_cents) ELSE 0 END), 0) AS month_income_cents,
        COUNT(tr.id) AS month_txn_count
       FROM trips t
       INNER JOIN transactions tr ON tr.trip_id = t.id
       WHERE tr.occurred_at >= ? AND tr.occurred_at < ?
       GROUP BY t.id
       ORDER BY MAX(tr.occurred_at) DESC`,
      [start, end],
    );
    return rows.map((r) => ({
      ...mapTrip(r),
      monthExpenseCents: Math.round(r.month_expense_cents),
      monthIncomeCents: Math.round(r.month_income_cents),
      monthTxnCount: r.month_txn_count,
    }));
  }

  async listForTransactionPicker(): Promise<Trip[]> {
    const rows = await this.db.getAllAsync<TripSqlRow>(
      `SELECT * FROM trips WHERE status != 'ARCHIVED' ORDER BY
        CASE status WHEN 'ACTIVE' THEN 0 WHEN 'PLANNED' THEN 1 WHEN 'COMPLETED' THEN 2 ELSE 3 END,
        datetime(start_at) DESC`,
    );
    return rows.map(mapTrip);
  }

  async summaryTripVsNormalForMonth(
    year: number,
    month: number,
  ): Promise<{ tripExpenseBaseCents: number; normalExpenseBaseCents: number }> {
    const { start, end } = monthRangeUtc(year, month);
    const row = await this.db.getFirstAsync<{
      trip_exp: number | null;
      normal_exp: number | null;
    }>(
      `SELECT
        SUM(CASE WHEN trip_id IS NOT NULL AND type = 'expense' THEN COALESCE(amount_base_cents, amount_cents) ELSE 0 END) AS trip_exp,
        SUM(CASE WHEN trip_id IS NULL AND type = 'expense' THEN COALESCE(amount_base_cents, amount_cents) ELSE 0 END) AS normal_exp
       FROM transactions
       WHERE occurred_at >= ? AND occurred_at < ?`,
      [start, end],
    );
    return {
      tripExpenseBaseCents: Math.round(Number(row?.trip_exp ?? 0)),
      normalExpenseBaseCents: Math.round(Number(row?.normal_exp ?? 0)),
    };
  }

  async spendingByCategoryForTrip(tripId: string): Promise<{ categoryId: string; categoryName: string; spentCents: number }[]> {
    const rows = await this.db.getAllAsync<{ category_id: string; name: string; spent: number }>(
      `SELECT t.category_id, c.name, SUM(COALESCE(t.amount_base_cents, t.amount_cents)) AS spent
       FROM transactions t
       JOIN categories c ON c.id = t.category_id
       WHERE t.trip_id = ? AND t.type = 'expense'
       GROUP BY t.category_id
       ORDER BY spent DESC`,
      [tripId],
    );
    return rows.map((r) => ({
      categoryId: r.category_id,
      categoryName: r.name,
      spentCents: Math.round(r.spent),
    }));
  }

  async listTripExpenseTotalsForYear(year: number): Promise<{ tripId: string; name: string; totalExpenseCents: number }[]> {
    const start = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
    const end = new Date(Date.UTC(year + 1, 0, 1, 0, 0, 0, 0)).toISOString();
    const rows = await this.db.getAllAsync<{ trip_id: string; name: string; total: number }>(
      `SELECT tr.trip_id, tp.name,
        SUM(CASE WHEN tr.type = 'expense' THEN COALESCE(tr.amount_base_cents, tr.amount_cents) ELSE 0 END) AS total
       FROM transactions tr
       JOIN trips tp ON tp.id = tr.trip_id
       WHERE tr.occurred_at >= ? AND tr.occurred_at < ? AND tr.trip_id IS NOT NULL
       GROUP BY tr.trip_id
       ORDER BY total DESC`,
      [start, end],
    );
    return rows.map((r) => ({
      tripId: r.trip_id,
      name: r.name,
      totalExpenseCents: Math.round(r.total),
    }));
  }
}
