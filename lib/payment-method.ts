import type { PaymentMethod } from '@/types/finance';

export function parsePaymentMethod(raw: string): PaymentMethod {
  const u = raw.trim().toUpperCase();
  if (u === 'VISA') return 'CARD';
  if (u === 'CARD' || u === 'CASH' || u === 'ACH' || u === 'OTHER') {
    return u as PaymentMethod;
  }
  return 'OTHER';
}

export function formatPaymentMethodLabel(pm: PaymentMethod): string {
  switch (pm) {
    case 'CARD':
      return 'Card';
    case 'CASH':
      return 'Cash';
    case 'ACH':
      return 'ACH';
    case 'OTHER':
      return 'Other';
    default:
      return pm;
  }
}
