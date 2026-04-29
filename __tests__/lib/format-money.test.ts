import { formatMoneyFromMinor } from '@/lib/format-money';

describe('formatMoneyFromMinor', () => {
  it('formats USD cents correctly', () => {
    const result = formatMoneyFromMinor(1234, 'USD', 'en-US');
    expect(result).toContain('12.34');
  });

  it('formats zero cents', () => {
    const result = formatMoneyFromMinor(0, 'USD', 'en-US');
    expect(result).toContain('0.00');
  });

  it('formats large amounts', () => {
    const result = formatMoneyFromMinor(999999999, 'USD', 'en-US');
    expect(result).toContain('9,999,999.99');
  });

  it('formats EUR', () => {
    const result = formatMoneyFromMinor(5000, 'EUR', 'en-US');
    expect(result).toContain('50.00');
  });

  it('formats INR', () => {
    const result = formatMoneyFromMinor(150000, 'INR', 'en-IN');
    // Indian locale uses different grouping
    expect(result).toContain('1,500');
  });

  it('handles negative amounts', () => {
    const result = formatMoneyFromMinor(-500, 'USD', 'en-US');
    expect(result).toContain('5.00');
  });

  it('falls back gracefully for invalid currency code', () => {
    const result = formatMoneyFromMinor(1000, 'INVALID', 'en-US');
    // Should use the fallback format
    expect(result).toContain('10.00');
  });
});