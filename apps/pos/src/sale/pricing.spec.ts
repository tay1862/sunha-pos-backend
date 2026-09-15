import { describe, expect, it } from 'vitest';
import { cashChange, formatLak, saleTotals } from './pricing';

describe('cashier displayed totals', () => {
  it('includes tax and discount in the amount due and change', () => {
    const totals = saleTotals(
      [{ price: '10000', quantity: 1 }],
      [{ mode: 'EXCLUSIVE', rateBasisPoints: 1000 }],
      '1000',
    );
    expect(totals).toEqual({ subtotal: '10000', discount: '1000', tax: '900', total: '9900' });
    expect(cashChange(totals.total, '20000')).toBe('10100');
    expect(cashChange(totals.total, '9899')).toBeNull();
    expect(cashChange(totals.total, 'invalid')).toBeNull();
  });
  it('shows inclusive tax without charging it twice', () => {
    expect(
      saleTotals(
        [{ price: '11000', quantity: 1 }],
        [{ mode: 'INCLUSIVE', rateBasisPoints: 1000 }],
        '',
      ).total,
    ).toBe('11000');
  });
  it('preserves amounts beyond number precision and rejects invalid configuration', () => {
    expect(saleTotals([{ price: '9007199254740993', quantity: 2 }], [], '').total).toBe(
      '18014398509481986',
    );
    expect(formatLak('9007199254740993')).toBe('9,007,199,254,740,993 ₭');
    expect(() => saleTotals([], [], '-1')).toThrow('INVALID_DISCOUNT');
    expect(() =>
      saleTotals(
        [],
        [
          { mode: 'INCLUSIVE', rateBasisPoints: 100 },
          { mode: 'EXCLUSIVE', rateBasisPoints: 100 },
        ],
        '',
      ),
    ).toThrow('MIXED_TAX_MODES_NOT_SUPPORTED');
  });
});
