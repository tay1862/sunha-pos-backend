import { describe, expect, it, vi } from 'vitest';
import { ForbiddenException } from '@nestjs/common';
import { PermissionGuard } from './permission.guard.js';

function context(headers: Record<string, string>) {
  const request = { headers, user: { tenantId: 'tenant-1' } };
  return { getHandler: () => 'handler', getClass: () => 'class', switchToHttp: () => ({ getRequest: () => request }) } as never;
}

describe('PermissionGuard employee sessions', () => {
  it('rejects a switched employee header when session token does not match', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue('SELL') };
    const prisma = {
      employee: { findFirst: vi.fn().mockResolvedValue({ id: 'employee-2', storeId: 'store-1', role: 'CASHIER' }) },
      employeeSession: { findFirst: vi.fn().mockResolvedValue(null) },
      device: { findFirst: vi.fn() },
    };
    const guard = new PermissionGuard(reflector as never, prisma as never);
    await expect(guard.canActivate(context({ 'x-employee-id': 'employee-2', 'x-device-id': 'device-1', 'x-employee-session': 'session-1' }))).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('accepts an active session bound to the selected device', async () => {
    const reflector = { getAllAndOverride: vi.fn().mockReturnValue('SELL') };
    const prisma = {
      employee: { findFirst: vi.fn().mockResolvedValue({ id: 'employee-1', storeId: 'store-1', role: 'CASHIER' }) },
      employeeSession: { findFirst: vi.fn().mockResolvedValue({ id: 'session-1' }) },
      device: { findFirst: vi.fn().mockResolvedValue({ id: 'device-1', storeId: 'store-1', status: 'ACTIVE' }) },
    };
    const guard = new PermissionGuard(reflector as never, prisma as never);
    await expect(guard.canActivate(context({ 'x-employee-id': 'employee-1', 'x-device-id': 'device-1', 'x-employee-session': 'session-1' }))).resolves.toBe(true);
  });
});
