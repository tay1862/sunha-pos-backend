import { describe, expect, it } from 'vitest';
import { orderOperations, retryDelayMs, SyncService } from './sync.service.js';

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
    expect(retryDelayMs(1)).toBeGreaterThanOrEqual(750);
    expect(retryDelayMs(1)).toBeLessThanOrEqual(1_250);
    expect(retryDelayMs(3)).toBeGreaterThanOrEqual(3_000);
    expect(retryDelayMs(3)).toBeLessThanOrEqual(5_000);
    expect(retryDelayMs(99)).toBeGreaterThanOrEqual(2_700_000);
    expect(retryDelayMs(99)).toBeLessThanOrEqual(4_500_000);
  });

  it('reconciles a sync operation against its server order', async () => {
    const service = new SyncService(
      {
        syncOperation: {
          findFirst: () =>
            Promise.resolve({
              operationId: 'op-1',
              status: 'FAILED_REVIEW',
              lastError: 'TIMEOUT',
              attemptCount: 2,
              payload: { clientOrderId: 'order-1' },
            }),
        },
        order: { findFirst: () => Promise.resolve({ id: 'order-1' }) },
      } as never,
      {} as never,
      {} as never,
    );
    await expect(service.reconcile('tenant-1', 'op-1')).resolves.toMatchObject({
      order: { id: 'order-1' },
      status: 'FAILED_REVIEW',
    });
  });
});
