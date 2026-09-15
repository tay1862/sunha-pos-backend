import { describe, expect, it } from 'vitest';
import { refundQuantity } from './refund.service.js';

describe('refund approval and snapshot quantities', () => {
  it('restores fractional base quantity using the sale snapshot rounding', () => {
    expect(refundQuantity('0.333', '3')).toBe('0.999');
    expect(refundQuantity('0.334', '3')).toBe('1.002');
  });

  it('does not allow a negative quantity to be manufactured', () => {
    expect(() => refundQuantity('-1', '1')).toThrow();
  });
});
