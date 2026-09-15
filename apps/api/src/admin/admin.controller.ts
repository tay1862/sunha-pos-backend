import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Get,
  Param,
  Patch,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { AdminAuthGuard } from './admin-auth.guard.js';
import { AdminService } from './admin.service.js';

type AdminRequest = FastifyRequest & { adminActor?: string; adminRole?: string };

@Controller('admin')
@UseGuards(AdminAuthGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}
  @Get('overview') overview() {
    return this.admin.overview();
  }
  @Get('stores') stores() {
    return this.admin.stores();
  }
  @Get('stores/:tenantId/devices') devices(@Param('tenantId') tenantId: string) {
    return this.admin.devices(tenantId);
  }
  @Get('stores/:tenantId/sync') sync(@Param('tenantId') tenantId: string) {
    return this.admin.sync(tenantId);
  }
  @Get('stores/:tenantId/audit') audit(@Param('tenantId') tenantId: string) {
    return this.admin.audit(tenantId);
  }
  @Get('stores/:tenantId') detail(@Param('tenantId') tenantId: string) {
    return this.admin.detail(tenantId);
  }
  @Patch('stores/:tenantId/suspend') suspend(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
    @Req() request: AdminRequest,
  ) {
    if (!body?.reason?.trim()) throw new BadRequestException('SUSPEND_REASON_REQUIRED');
    if (request.adminRole !== 'MANAGE' && request.adminRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('ADMIN_ROLE_FORBIDDEN');
    }
    return this.admin.suspend(tenantId, body.reason.trim(), request.adminActor ?? 'internal-admin');
  }
  @Patch('stores/:tenantId/unsuspend') unsuspend(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
    @Req() request: AdminRequest,
  ) {
    if (!body?.reason?.trim()) throw new BadRequestException('UNSUSPEND_REASON_REQUIRED');
    if (request.adminRole !== 'MANAGE' && request.adminRole !== 'SUPER_ADMIN') {
      throw new ForbiddenException('ADMIN_ROLE_FORBIDDEN');
    }
    return this.admin.unsuspend(
      tenantId,
      body.reason.trim(),
      request.adminActor ?? 'internal-admin',
    );
  }
}
