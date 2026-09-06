import { createHash, randomBytes } from 'node:crypto';
import {
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { CreateDeviceInvitationInput, EnrollDeviceInput } from '@sunha/contracts';
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

  async sellingPolicy(tenantId: string, id: string) {
    const lease = await this.leaseStatus(tenantId, id);
    const device = await this.prisma.device.findUnique({ where: { id }, select: { storeId: true } });
    const sellingDeviceCount = device ? await this.prisma.device.count({ where: { storeId: device.storeId, status: 'ACTIVE' } }) : 0;
    return { ...lease, sellingDeviceCount, canChargeOffline: lease.canSellOffline && sellingDeviceCount === 1 };
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

  async createInvitation(tenantId: string, actorId: string, input: CreateDeviceInvitationInput) {
    await this.requireManager(tenantId, actorId);
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    const token = randomBytes(32).toString('base64url');
    await this.prisma.deviceEnrollmentToken.create({
      data: {
        tenantId,
        storeId: store.id,
        deviceName: input.deviceName,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    return { token, expiresInSeconds: 600 };
  }

  async enroll(input: EnrollDeviceInput) {
    const tokenRecord = await this.prisma.deviceEnrollmentToken.findUnique({
      where: { tokenHash: hashToken(input.token) },
    });
    if (!tokenRecord || tokenRecord.usedAt || tokenRecord.expiresAt <= new Date())
      throw new UnauthorizedException('INVALID_DEVICE_INVITATION');
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    return this.prisma.$transaction(async (tx) => {
      const used = await tx.deviceEnrollmentToken.updateMany({
        where: { id: tokenRecord.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (used.count !== 1) throw new UnauthorizedException('INVALID_DEVICE_INVITATION');
      const device = await tx.device.create({
        data: {
          tenantId: tokenRecord.tenantId,
          storeId: tokenRecord.storeId,
          name: input.deviceName ?? tokenRecord.deviceName,
          publicKey: input.publicKey,
          status: 'ACTIVE',
          offlineLeaseExpiresAt: expiresAt,
          lastSeenAt: new Date(),
        },
        select: { id: true, name: true, status: true, offlineLeaseExpiresAt: true },
      });
      return { device, canSellOffline: true };
    });
  }

  async list(tenantId: string) {
    return this.prisma.device.findMany({
      where: { tenantId },
      select: {
        id: true,
        storeId: true,
        name: true,
        status: true,
        offlineLeaseExpiresAt: true,
        lastSeenAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revoke(tenantId: string, actorId: string, id: string) {
    await this.requireManager(tenantId, actorId);
    const device = await this.prisma.device.findFirst({ where: { id, tenantId } });
    if (!device) throw new NotFoundException('DEVICE_NOT_FOUND');
    await this.prisma.device.update({
      where: { id },
      data: { status: 'REVOKED', offlineLeaseExpiresAt: new Date() },
    });
    return { deviceId: id, status: 'REVOKED' as const };
  }

  private async requireManager(tenantId: string, actorId: string) {
    const actor = await this.prisma.employee.findFirst({
      where: { id: actorId, tenantId, active: true },
    });
    if (!actor || !['OWNER', 'MANAGER'].includes(actor.role))
      throw new ForbiddenException('MANAGER_PERMISSION_REQUIRED');
  }
}

function hashToken(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}
