import { CanActivate, ExecutionContext, Injectable, UnauthorizedException, ForbiddenException } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { verifyAccessToken, type AuthClaims } from './auth.service.js';
import { PrismaService } from '../database/prisma.service.js';

type RequestWithUser = FastifyRequest & { user?: AuthClaims };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const header = request.headers.authorization;
    if (!header?.startsWith('Bearer ')) throw new UnauthorizedException('MISSING_ACCESS_TOKEN');
    try {
      request.user = await verifyAccessToken(header.slice(7));
      const tenant = await this.prisma.tenant.findUnique({ where: { id: request.user.tenantId }, select: { suspendedAt: true } });
      if (!tenant || tenant.suspendedAt) throw new ForbiddenException('STORE_SUSPENDED');
      return true;
    } catch {
      throw new UnauthorizedException('INVALID_ACCESS_TOKEN');
    }
  }
}
