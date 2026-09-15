import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';

@Injectable()
export class AdminAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<FastifyRequest>();
    const token = request.headers['x-admin-token'];
    const mfa = request.headers['x-admin-mfa'];
    if (
      !matches(token, process.env.INTERNAL_ADMIN_TOKEN) ||
      !matches(mfa, process.env.INTERNAL_ADMIN_MFA_TOKEN)
    )
      throw new UnauthorizedException('ADMIN_MFA_REQUIRED');
    const role = (process.env.INTERNAL_ADMIN_ROLE ?? 'MANAGE').toUpperCase();
    const actor = process.env.INTERNAL_ADMIN_ACTOR?.trim() || 'internal-admin';
    (request as FastifyRequest & { adminRole?: string; adminActor?: string }).adminRole = role;
    (request as FastifyRequest & { adminRole?: string; adminActor?: string }).adminActor = actor;
    const required = Reflect.getMetadata('adminRole', context.getHandler()) as string | undefined;
    if (required && role !== 'SUPER_ADMIN' && role !== required) {
      throw new ForbiddenException('ADMIN_ROLE_FORBIDDEN');
    }
    return true;
  }
}

function matches(value: string | string[] | undefined, expected: string | undefined): boolean {
  if (typeof value !== 'string' || !expected) return false;
  const actual = Buffer.from(value);
  const wanted = Buffer.from(expected);
  return actual.length === wanted.length && timingSafeEqual(actual, wanted);
}
