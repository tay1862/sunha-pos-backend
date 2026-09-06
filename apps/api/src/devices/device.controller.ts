import { Controller, Get, Param, Post, Req, UseGuards } from '@nestjs/common';
import type { FastifyRequest } from 'fastify';
import { JwtAuthGuard } from '../auth/jwt-auth.guard.js';
import type { AuthClaims } from '../auth/auth.service.js';
import { DeviceService } from './device.service.js';
type AuthRequest = FastifyRequest & { user: AuthClaims };
@Controller('devices')
@UseGuards(JwtAuthGuard)
export class DeviceController {
  constructor(private readonly devices: DeviceService) {}
  @Get(':id/lease') lease(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.devices.leaseStatus(r.user.tenantId, id);
  }
  @Post(':id/lease/renew') renew(@Req() r: AuthRequest, @Param('id') id: string) {
    return this.devices.renewLease(r.user.tenantId, id);
  }
}
