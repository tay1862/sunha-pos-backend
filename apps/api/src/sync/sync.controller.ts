import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { syncPushSchema } from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { SyncService } from './sync.service.js';
type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('sync')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SyncController {
  constructor(private readonly sync: SyncService) {}
  @RequirePermission('SELL')
  @Post('push')
  push(@Req() r: AuthRequest, @Body() body: unknown) {
    const p = syncPushSchema.safeParse(body);
    if (!p.success) throw new BadRequestException('INVALID_SYNC_BATCH');
    return this.sync.push(r.user.tenantId, p.data);
  }
  @RequirePermission('SELL')
  @Get('pull')
  pull(@Req() r: AuthRequest, @Query('cursor') cursor?: string) {
    return this.sync.pull(r.user.tenantId, cursor);
  }
}
