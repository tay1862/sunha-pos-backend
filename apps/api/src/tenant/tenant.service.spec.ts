import { describe, expect, it } from 'vitest';
import { InMemoryTenantRepository, TenantService } from './tenant.service.js';

describe('TenantService', () => {
  it('creates one Lao store and owner for a signup', async () => {
    const service = new TenantService(new InMemoryTenantRepository());

    const result = await service.createTenant({
      email: 'owner@example.com',
      businessName: 'Sunha Cafe',
      country: 'LA',
    });

    expect(result.tenant.businessName).toBe('Sunha Cafe');
    expect(result.store.currency).toBe('LAK');
    expect(result.store.timezone).toBe('Asia/Vientiane');
    expect(result.owner.email).toBe('owner@example.com');
  });

  it('rejects a duplicate owner email', async () => {
    const repository = new InMemoryTenantRepository();
    const service = new TenantService(repository);
    const input = { email: 'owner@example.com', businessName: 'A', country: 'LA' as const };

    await service.createTenant(input);
    await expect(service.createTenant({ ...input, businessName: 'B' })).rejects.toThrow(
      'Owner email already exists',
    );
  });
});
