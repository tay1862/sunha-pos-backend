import { describe, expect, it } from 'vitest';
import { orderOperations, retryDelayMs } from './sync.service.js';

describe('offline sync helpers', () => {
  it('orders operations deterministically for dependency-safe replay', () => {
    const result = orderOperations([
      { operationId: 'b', occurredAtDevice: '2026-01-01T00:00:01.000Z' },
      { operationId: 'a', occurredAtDevice: '2026-01-01T00:00:00.000Z' },
      { operationId: 'c', occurredAtDevice: '2026-01-01T00:00:01.000Z' },
    ]);
    expect(result.map((item) => item.operationId)).toEqual(['a', 'b', 'c']);
  });

  it('uses bounded exponential retry delay', () => {
    expect(retryDelayMs(1)).toBe(1_000);
    expect(retryDelayMs(3)).toBe(4_000);
    expect(retryDelayMs(99)).toBe(3_600_000);
  });
});
