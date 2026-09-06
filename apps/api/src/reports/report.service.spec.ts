import { describe, expect, it } from 'vitest';
import { calculateNetSales } from './report.service.js';

describe('payment and refund reconciliation', () => {
  it('subtracts full refunds from net sales exactly once', () => {
    expect(calculateNetSales([{ totalAmount: 100000n }, { totalAmount: 50000n }], [{ amount: 50000n }])).toBe(100000n);
  });
});
