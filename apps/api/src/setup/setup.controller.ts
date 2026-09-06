import { BadRequestException, Body, Controller, Get, Patch, Req, UseGuards } from '@nestjs/common';
import { updateStoreSettingsSchema } from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { SetupService } from './setup.service.js';

type AuthRequest = FastifyRequest & { user: AuthClaims };

@Controller('setup')
@UseGuards(JwtAuthGuard, PermissionGuard)
export class SetupController {
  constructor(private readonly setup: SetupService) {}

  @Get('store')
  @RequirePermission('MANAGE_SETTINGS')
  getStore(@Req() request: AuthRequest) {
    return this.setup.getStore(request.user.tenantId);
  }

  @Patch('store')
  @RequirePermission('MANAGE_SETTINGS')
  updateStore(@Req() request: AuthRequest, @Body() body: unknown) {
    const parsed = updateStoreSettingsSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_STORE_SETTINGS');
    return this.setup.updateStore(request.user.tenantId, parsed.data);
  }
}
