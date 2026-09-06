import { describe, expect, it, vi } from 'vitest';
import { InventoryService } from './inventory.service.js';
vi.mock('argon2', () => ({ default: { verify: vi.fn().mockResolvedValue(true) } }));

describe('inventory adjustment policy', () => {
  it('rejects an adjustment that would make stock negative', async () => {
    const tx = {
      inventoryLevel: {
        updateMany: vi.fn().mockResolvedValue({ count: 0 }),
        findUniqueOrThrow: vi.fn(),
        upsert: vi.fn(),
      },
      inventoryMovement: { create: vi.fn() },
    };
    const prisma = {
      employee: { findFirst: vi.fn().mockResolvedValue({ id: 'manager-1', role: 'MANAGER' }) },
      item: { findFirst: vi.fn().mockResolvedValue({ id: 'item-1', trackStock: true }) },
      $transaction: vi.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    } as never;
    const service = new InventoryService(prisma);
    await expect(service.adjust('tenant-1', 'cashier-1', { itemId: 'item-1', quantityBase: '-1', reason: 'waste', managerEmployeeId: 'manager-1', managerPin: '123456' }))
      .rejects.toThrow('INSUFFICIENT_STOCK');
    expect(tx.inventoryMovement.create).not.toHaveBeenCalled();
  });

  it('does not allow stock adjustment for non-stock-tracked items', async () => {
    const prisma = { employee: { findFirst: vi.fn().mockResolvedValue({ id: 'manager-1', role: 'MANAGER' }) }, item: { findFirst: vi.fn().mockResolvedValue({ id: 'item-1', trackStock: false }) } } as never;
    const service = new InventoryService(prisma);
    await expect(service.adjust('tenant-1', 'owner-1', { itemId: 'item-1', quantityBase: '1', reason: 'count', managerEmployeeId: 'manager-1', managerPin: '123456' }))
      .rejects.toThrow('TRACK_STOCK_DISABLED');
  });
});
