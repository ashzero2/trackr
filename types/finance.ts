export type EntryType = 'expense' | 'income';

export type PaymentMethod = 'VISA' | 'CASH' | 'ACH' | 'OTHER';

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
