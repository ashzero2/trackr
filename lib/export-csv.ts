import type { TransactionWithCategory } from '@/types/finance';

function esc(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function transactionsToCsv(rows: TransactionWithCategory[]): string {
  const header = 'id,date,type,amount_cents,category,note,payment_method,created_at';
  const lines = rows.map((r) =>
    [
      esc(r.id),
      esc(r.occurredAt),
      r.type,
      String(r.amountCents),
      esc(r.categoryName),
      esc(r.note ?? ''),
      r.paymentMethod,
      esc(r.createdAt),
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
