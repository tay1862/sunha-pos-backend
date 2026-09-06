import { Controller, Get, Param, Query, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { ReceiptService } from './receipt.service.js';

type AuthRequest = FastifyRequest & { user: AuthClaims };

@Controller('receipts')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class ReceiptController {
  constructor(private readonly receipts: ReceiptService) {}

  @RequirePermission('VIEW_RECEIPTS')
  @Get()
  list(@Req() request: AuthRequest, @Query('search') search?: string) {
    return this.receipts.list(request.user.tenantId, search?.trim() || undefined);
  }

  @RequirePermission('VIEW_RECEIPTS')
  @Get(':id')
  get(@Req() request: AuthRequest, @Param('id') id: string) {
    return this.receipts.get(request.user.tenantId, id);
  }
}
