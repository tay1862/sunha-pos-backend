import { describe, expect, it, vi } from 'vitest';
import { SetupService } from './setup.service.js';

describe('store setup/settings', () => {
  it('returns persisted store settings with LAK as the canonical currency', async () => {
    const store = { id: 'store-1', tenantId: 'tenant-1', name: 'Cafe', address: '', phone: '', taxNumber: '', currency: 'USD', timezone: 'Asia/Vientiane', language: 'lo' };
    const prisma = { store: { findUnique: vi.fn().mockResolvedValue(store) } };
    await expect(new SetupService(prisma as never).getStore('tenant-1')).resolves.toMatchObject({ name: 'Cafe', currency: 'LAK' });
  });

  it('updates only the authorized tenant store', async () => {
    const updated = { id: 'store-1', tenantId: 'tenant-1', name: 'New Cafe', address: 'Vientiane', phone: '', taxNumber: '', currency: 'LAK', timezone: 'Asia/Vientiane', language: 'lo' };
    const prisma = { store: { findUnique: vi.fn().mockResolvedValue(updated), update: vi.fn().mockResolvedValue(updated) } };
    await expect(new SetupService(prisma as never).updateStore('tenant-1', { name: 'New Cafe' })).resolves.toMatchObject({ name: 'New Cafe' });
    expect(prisma.store.update).toHaveBeenCalledWith(expect.objectContaining({ where: { tenantId: 'tenant-1' } }));
  });
});
