import { describe, expect, it, vi } from 'vitest';
import { AdminService } from './admin.service.js';

describe('internal admin tenant actions', () => {
  it('records actor, reason and before/after when suspending', async () => {
    const prisma = {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ id: 't1', suspendedAt: null }),
        update: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    const result = await new AdminService(prisma as never).suspend('t1', 'fraud review', 'ops-a');
    expect(result.alreadySuspended).toBe(false);
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          action: 'ADMIN_SUSPEND_STORE',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          metadata: expect.objectContaining({
            actor: 'ops-a',
            before: 'ACTIVE',
            after: 'SUSPENDED',
          }),
        }),
      }),
    );
  });

  it('restores a suspended tenant and emits a separate audit event', async () => {
    const prisma = {
      tenant: {
        findUnique: vi.fn().mockResolvedValue({ id: 't1', suspendedAt: new Date('2026-01-01') }),
        update: vi.fn(),
      },
      auditEvent: { create: vi.fn() },
      $transaction: vi.fn().mockResolvedValue([]),
    };
    await expect(
      new AdminService(prisma as never).unsuspend('t1', 'appeal approved', 'ops-b'),
    ).resolves.toMatchObject({ suspendedAt: null });
    expect(prisma.auditEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data: expect.objectContaining({
          action: 'ADMIN_UNSUSPEND_STORE',
          // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
          metadata: expect.objectContaining({
            actor: 'ops-b',
            before: 'SUSPENDED',
            after: 'ACTIVE',
          }),
        }),
      }),
    );
  });
});
