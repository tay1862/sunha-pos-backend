import { BadRequestException, Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { refundSchema } from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { RefundService } from './refund.service.js';
type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('refunds')
@UseGuards(JwtAuthGuard)
export class RefundController {
  constructor(private readonly refunds: RefundService) {}
  @Post() create(@Req() r: AuthRequest, @Body() body: unknown) {
    const p = refundSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('INVALID_REFUND');
    return this.refunds.refund(r.user.tenantId, String(r.headers['x-employee-id']), p.data);
  }
}
