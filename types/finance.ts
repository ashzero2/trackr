export type EntryType = 'expense' | 'income';

export type PaymentMethod = 'CARD' | 'CASH' | 'ACH' | 'OTHER';

export type TripStatus = 'PLANNED' | 'ACTIVE' | 'COMPLETED' | 'ARCHIVED';

export type Trip = {
  id: string;
  name: string;
  startAt: string;
  endAt: string | null;
  status: TripStatus;
  createdAt: string;
  metadata: string | null;
};

export type TripSummary = {
  tripId: string;
  totalExpenseCents: number;
  totalIncomeCents: number;
  txnCount: number;
  firstOccurredAt: string | null;
  lastOccurredAt: string | null;
  totalDays: number;
  lastUpdated: string;
};

/** Trip row plus spend in a specific calendar month (UTC range), for History Trips segment */
export type TripMonthActivity = Trip & {
  monthExpenseCents: number;
  monthIncomeCents: number;
  monthTxnCount: number;
};

export enum ViewMode {
  NORMAL = 'NORMAL',
  TRAVEL = 'TRAVEL',
}

export type Category = {
  id: string;
  name: string;
  type: EntryType;
  iconKey: string;
  sortOrder: number;
  createdAt: string;
};

export type Transaction = {
  id: string;
  amountCents: number;
  type: EntryType;
  categoryId: string;
  occurredAt: string;
  note: string | null;
  paymentMethod: PaymentMethod;
  createdAt: string;
  tripId: string | null;
  /** ISO 4217; null means same as profile primary currency (legacy rows) */
  currencyCode: string | null;
  /** Amount in profile base currency minor units for analytics; null treated as amountCents */
  amountBaseCents: number | null;
  exchangeRateToBase: number | null;
};

/** Transaction with joined category fields for list UIs */
export type TransactionWithCategory = Transaction & {
  categoryName: string;
  categoryIconKey: string;
};

export type Budget = {
  id: string;
  categoryId: string | null;
  year: number;
  month: number;
  limitCents: number;
  createdAt: string;
};

export type MonthSummary = {
  totalExpenseCents: number;
  totalIncomeCents: number;
};

export type RecurrenceFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'yearly';

export type RecurringTransaction = {
  id: string;
  title: string;
  amountCents: number;
  type: EntryType;
  categoryId: string;
  paymentMethod: PaymentMethod;
  note: string | null;
  currencyCode: string | null;
  frequency: RecurrenceFrequency;
  /** Day of month (1–31) — used for `monthly` frequency */
  dayOfMonth: number | null;
  /** Day of week (0=Sun … 6=Sat) — used for `weekly` and `biweekly` */
  dayOfWeek: number | null;
  startsAt: string;
  endsAt: string | null;
  /** ISO date of the next occurrence */
  nextDueAt: string;
  /** false = show confirmation prompt; true = insert silently */
  autoInsert: boolean;
  lastInsertedAt: string | null;
  createdAt: string;
};

/** Base-currency minor units for analytics (falls back to stored amount). */
export function effectiveBaseCents(tx: Pick<Transaction, 'amountCents' | 'amountBaseCents'>): number {
  return tx.amountBaseCents ?? tx.amountCents;
}
