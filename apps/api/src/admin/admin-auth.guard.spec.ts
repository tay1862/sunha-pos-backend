import { afterEach, describe, expect, it } from 'vitest';
import { UnauthorizedException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard.js';

const context = (request: Record<string, unknown>): ExecutionContext =>
  ({
    switchToHttp: () => ({ getRequest: () => request }),
    getHandler: () => () => undefined,
  }) as never;

describe('admin authentication and role', () => {
  afterEach(() => {
    delete process.env.INTERNAL_ADMIN_TOKEN;
    delete process.env.INTERNAL_ADMIN_MFA_TOKEN;
    delete process.env.INTERNAL_ADMIN_ROLE;
    delete process.env.INTERNAL_ADMIN_ACTOR;
  });

  it('rejects invalid MFA', () => {
    process.env.INTERNAL_ADMIN_TOKEN = 'token';
    process.env.INTERNAL_ADMIN_MFA_TOKEN = 'mfa';
    expect(() =>
      new AdminAuthGuard().canActivate(
        context({ headers: { 'x-admin-token': 'token', 'x-admin-mfa': 'wrong' } }),
      ),
    ).toThrow(UnauthorizedException);
  });

  it('attaches server configured read-only role and actor', () => {
    process.env.INTERNAL_ADMIN_TOKEN = 'token';
    process.env.INTERNAL_ADMIN_MFA_TOKEN = 'mfa';
    process.env.INTERNAL_ADMIN_ROLE = 'READ_ONLY';
    process.env.INTERNAL_ADMIN_ACTOR = 'auditor@example.com';
    const request: Record<string, unknown> = {
      headers: { 'x-admin-token': 'token', 'x-admin-mfa': 'mfa' },
    };
    expect(new AdminAuthGuard().canActivate(context(request))).toBe(true);
    expect(request).toMatchObject({ adminRole: 'READ_ONLY', adminActor: 'auditor@example.com' });
  });
});
