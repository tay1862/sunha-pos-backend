import { describe, expect, it } from 'vitest';
import {
  baseQuantity,
  calculatePaymentAmounts,
  calculateTotals,
  modifierUnitPrice,
} from './order.service.js';

describe('order money and stock calculations', () => {
  it('converts pack quantities into base units without leaking integer scale', () => {
    expect(baseQuantity('2', '6')).toBe('12');
    expect(baseQuantity('1.5', '6')).toBe('9');
    expect(baseQuantity('0.125', '2')).toBe('0.25');
  });

  it('calculates discount and tax from integer LAK amounts', () => {
    expect(
      calculateTotals({
        lines: [{ unitPrice: '10000', quantity: '2' }],
        discount: { type: 'PERCENTAGE', basisPoints: 1000 },
        taxRateBasisPoints: 700,
      }),
    ).toEqual({ subtotal: '20000', discount: '2000', tax: '1260', total: '19260' });
  });

  it('snapshots modifier deltas into an effective unit price', () => {
    expect(modifierUnitPrice('30000', ['5000', '-2000'])).toBe(33000n);
    expect(() => modifierUnitPrice('1000', ['-1001'])).toThrow('INVALID_MODIFIER_PRICE');
  });

  it('calculates cash change exactly and rejects insufficient tender', () => {
    expect(calculatePaymentAmounts('CASH', '19260', '20000')).toEqual({
      tenderedAmount: 20000n,
      changeAmount: 740n,
    });
    expect(calculatePaymentAmounts('BANK_TRANSFER', '19260')).toEqual({
      tenderedAmount: null,
      changeAmount: null,
    });
    expect(() => calculatePaymentAmounts('CASH', '19260', '19259')).toThrow('INSUFFICIENT_TENDER');
  });
});
