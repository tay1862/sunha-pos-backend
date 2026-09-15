import { describe, expect, it } from 'vitest';
import { cashMovementAmount } from './shift.service.js';

describe('cash movement direction', () => {
  it('accepts the signed contract used by existing POS clients', () => {
    expect(cashMovementAmount({ type: 'CASH_IN', amount: '100', reason: 'float' })).toBe(100n);
    expect(cashMovementAmount({ type: 'CASH_OUT', amount: '-100', reason: 'expense' })).toBe(-100n);
  });
  it('rejects contradictory directions, zero and malformed amounts', () => {
    for (const amount of ['100', '0', 'NaN', '--100'])
      expect(() => cashMovementAmount({ type: 'CASH_OUT', amount, reason: 'expense' })).toThrow(
        'INVALID_CASH_MOVEMENT_AMOUNT',
      );
    expect(() => cashMovementAmount({ type: 'CASH_IN', amount: '-100', reason: 'float' })).toThrow(
      'INVALID_CASH_MOVEMENT_AMOUNT',
    );
  });
});
