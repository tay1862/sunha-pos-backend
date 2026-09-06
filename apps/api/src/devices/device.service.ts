import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class DeviceService {
  constructor(private readonly prisma: PrismaService) {}

  async leaseStatus(tenantId: string, id: string) {
    const device = await this.prisma.device.findFirst({ where: { id, tenantId } });
    if (!device) throw new NotFoundException('DEVICE_NOT_FOUND');
    const expired = !device.offlineLeaseExpiresAt || device.offlineLeaseExpiresAt <= new Date();
    return {
      deviceId: device.id,
      status: device.status,
      offlineLeaseExpiresAt: device.offlineLeaseExpiresAt,
      expired,
      canSellOffline: device.status === 'ACTIVE' && !expired,
    };
  }

  async renewLease(tenantId: string, id: string) {
    const device = await this.prisma.device.findFirst({
      where: { id, tenantId, status: 'ACTIVE' },
    });
    if (!device) throw new NotFoundException('DEVICE_NOT_FOUND');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await this.prisma.device.update({
      where: { id },
      data: { offlineLeaseExpiresAt: expiresAt, lastSeenAt: new Date() },
    });
    return { deviceId: id, offlineLeaseExpiresAt: expiresAt, canSellOffline: true };
  }
}
