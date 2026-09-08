import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.headers['x-admin-token'];
    const mfa = request.headers['x-admin-mfa'];
    if (!matches(token, process.env.INTERNAL_ADMIN_TOKEN) || !matches(mfa, process.env.INTERNAL_ADMIN_MFA_TOKEN))
      throw new UnauthorizedException('ADMIN_MFA_REQUIRED');
    return true;
  }
}

function matches(value: string | string[] | undefined, expected: string | undefined): boolean {
  if (typeof value !== 'string' || !expected) return false;
  const actual = Buffer.from(value); const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
