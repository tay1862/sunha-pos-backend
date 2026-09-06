import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { createDeviceInvitationSchema, enrollDeviceSchema } from '@sunha/contracts';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import { PermissionGuard, RequirePermission } from '../auth/permission.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { DeviceService } from './device.service.js';
type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('devices')
export class DeviceController {
  constructor(private readonly devices: DeviceService) {}

  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('SELL')
  @Get('current/policy')
  policy(@Req() r: AuthRequest) {
    return this.devices.sellingPolicy(r.user.tenantId, String(r.headers['x-device-id']));
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('MANAGE_DEVICES')
  @Get(':id/lease')
  lease(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.devices.leaseStatus(r.user.tenantId, id);
  }
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('MANAGE_DEVICES')
  @Post(':id/lease/renew')
  renew(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.devices.renewLease(r.user.tenantId, id);
  }

  @Get()
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('MANAGE_DEVICES')
  list(@Req() r: AuthRequest) {
    return this.devices.list(r.user.tenantId);
  }

  @Post('invitations')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('MANAGE_DEVICES')
  invite(@Req() r: AuthRequest, @Body() body: unknown) {
    const parsed = createDeviceInvitationSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_DEVICE_INVITATION');
    return this.devices.createInvitation(r.user.tenantId, this.actor(r), parsed.data);
  }

  @Post('enroll')
  enroll(@Body() body: unknown) {
    const parsed = enrollDeviceSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('INVALID_DEVICE_ENROLLMENT');
    return this.devices.enroll(parsed.data);
  }

  @Post(':id/revoke')
  @UseGuards(JwtAuthGuard, PermissionGuard)
  @RequirePermission('MANAGE_DEVICES')
  revoke(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.devices.revoke(r.user.tenantId, this.actor(r), id);
  }

  private actor(request: AuthRequest): string {
    const actor = request.headers['x-employee-id'];
    if (typeof actor !== 'string') throw new BadRequestException('EMPLOYEE_REQUIRED');
    return actor;
  }
}
