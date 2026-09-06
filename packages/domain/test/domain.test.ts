import { describe, expect, it } from 'vitest';
import {
  addMoney,
  applyOrderDiscount,
  calculateOrderTotals,
  calculateTax,
  multiplyMoney,
  parseQuantity,
  subtractMoney,
  toBaseQuantity,
} from '../src/index.js';

describe('integer money arithmetic', () => {
  it('adds and subtracts integer-string LAK amounts exactly', () => {
    expect(
      addMoney({ amount: '9007199254740993', currency: 'LAK' }, { amount: '7', currency: 'LAK' }),
    ).toEqual({ amount: '9007199254741000', currency: 'LAK' });
    expect(
      subtractMoney({ amount: '1000', currency: 'LAK' }, { amount: '250', currency: 'LAK' }),
    ).toEqual({ amount: '750', currency: 'LAK' });
  });

  it('multiplies money by a decimal quantity without floating point arithmetic', () => {
    expect(multiplyMoney({ amount: '15001', currency: 'LAK' }, '1.250')).toEqual({
      amount: '18751',
      currency: 'LAK',
    });
  });
});

describe('quantities and units', () => {
  it('accepts non-negative decimal quantities with at most three fractional digits', () => {
    expect(parseQuantity('12.345')).toBe('12.345');
    expect(parseQuantity('0')).toBe('0');
  });

  it.each(['-1', '1.2345', '1e3', 'NaN', ''])('rejects invalid quantity %s', (value) => {
    expect(() => parseQuantity(value)).toThrow('Invalid quantity');
  });

  it('converts a sale quantity to the base unit deterministically', () => {
    expect(toBaseQuantity('2.500', '6')).toBe('15');
    expect(toBaseQuantity('2', '0.125')).toBe('0.25');
  });
});

describe('discount and tax', () => {
  it('applies a fixed discount without allowing a negative subtotal', () => {
    expect(applyOrderDiscount('10000', { type: 'FIXED', amount: '12000' })).toBe('10000');
  });

  it('applies a percentage discount in basis points with half-up rounding', () => {
    expect(applyOrderDiscount('10005', { type: 'PERCENTAGE', basisPoints: 1250 })).toBe('1251');
  });

  it('calculates exclusive and inclusive tax deterministically', () => {
    expect(calculateTax('10000', 1000, 'EXCLUSIVE')).toBe('1000');
    expect(calculateTax('11000', 1000, 'INCLUSIVE')).toBe('1000');
  });
});

describe('order totals', () => {
  it('calculates subtotal, discount, tax and total from string inputs', () => {
    expect(
      calculateOrderTotals({
        lines: [
          { unitPrice: '15000', quantity: '2' },
          { unitPrice: '5000', quantity: '1.5' },
        ],
        discount: { type: 'PERCENTAGE', basisPoints: 1000 },
        tax: { rateBasisPoints: 1000, mode: 'EXCLUSIVE' },
      }),
    ).toEqual({ subtotal: '37500', discount: '3750', tax: '3375', total: '37125' });
  });

  it('extracts inclusive tax without adding it to the final total', () => {
    expect(
      calculateOrderTotals({
        lines: [{ unitPrice: '11000', quantity: '1' }],
        tax: { rateBasisPoints: 1000, mode: 'INCLUSIVE' },
      }),
    ).toEqual({ subtotal: '11000', discount: '0', tax: '1000', total: '11000' });
  });
});
