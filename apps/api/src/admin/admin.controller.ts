import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { AdminAuthGuard } from './admin-auth.guard.js';
import { AdminService } from './admin.service.js';

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
  @Patch('stores/:tenantId/suspend') suspend(
    @Param('tenantId') tenantId: string,
    @Body() body: { reason?: string },
  ) {
    if (!body?.reason?.trim()) throw new BadRequestException('SUSPEND_REASON_REQUIRED');
    return this.admin.suspend(tenantId, body.reason.trim());
  }
}
