import { BadRequestException, Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import { inventoryAdjustmentSchema } from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { InventoryService } from './inventory.service.js';

type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('inventory')
@UseGuards(JwtAuthGuard)
export class InventoryController {
  constructor(private readonly inventory: InventoryService) {}
  @Get('levels') levels(@Req() request: AuthRequest) {
    return this.inventory.list(request.user.tenantId);
  }
  @Post('adjustments') adjust(@Req() request: AuthRequest, @Body() body: unknown) {
    const parsed = inventoryAdjustmentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_INVENTORY_ADJUSTMENT');
    return this.inventory.adjust(request.user.tenantId, parsed.data);
  }
}
