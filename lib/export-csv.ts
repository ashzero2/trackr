import { formatPaymentMethodLabel } from '@/lib/payment-method';
import type { TransactionWithCategory } from '@/types/finance';

function esc(s: string): string {
  if (s.includes(',') || s.includes('"') || s.includes('\n')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function transactionsToCsv(rows: TransactionWithCategory[]): string {
  const header =
    'id,date,type,amount_cents,category,note,payment_method,created_at,trip_id,currency_code,amount_base_cents,exchange_rate_to_base';
  const lines = rows.map((r) =>
    [
      esc(r.id),
      esc(r.occurredAt),
      r.type,
      String(r.amountCents),
      esc(r.categoryName),
      esc(r.note ?? ''),
      formatPaymentMethodLabel(r.paymentMethod),
      esc(r.createdAt),
      r.tripId ? esc(r.tripId) : '',
      r.currencyCode ? esc(r.currencyCode) : '',
      String(r.amountBaseCents ?? r.amountCents),
      String(r.exchangeRateToBase ?? 1),
    ].join(','),
  );
  return [header, ...lines].join('\n');
}
