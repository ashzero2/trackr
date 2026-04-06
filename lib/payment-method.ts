import type { PaymentMethod } from '@/types/finance';

export function parsePaymentMethod(raw: string): PaymentMethod {
  if (raw === 'VISA' || raw === 'CASH' || raw === 'ACH' || raw === 'OTHER') {
    return raw;
  }
  return 'OTHER';
}
