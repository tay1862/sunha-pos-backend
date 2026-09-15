import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class AdminService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const [stores, devices, pendingSync] = await Promise.all([
      this.prisma.tenant.count(),
      this.prisma.device.count(),
      this.prisma.syncOperation.count({ where: { status: { in: ['PENDING', 'FAILED_REVIEW'] } } }),
    ]);
    return { stores, devices, pendingSync };
  }

  stores() {
    return this.prisma.tenant.findMany({
      select: {
        id: true,
        businessName: true,
        suspendedAt: true,
        createdAt: true,
        store: { select: { name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async detail(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: {
        id: true,
        businessName: true,
        suspendedAt: true,
        createdAt: true,
        store: { select: { name: true } },
      },
    });
    if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');
    const [devices, sync, audit] = await Promise.all([
      this.devices(tenantId),
      this.sync(tenantId),
      this.audit(tenantId),
    ]);
    return { ...tenant, devices, sync, audit };
  }

  devices(tenantId: string) {
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

  sync(tenantId: string) {
    return this.prisma.syncOperation.findMany({
      where: { tenantId },
      select: {
        operationId: true,
        deviceId: true,
        employeeId: true,
        type: true,
        status: true,
        attemptCount: true,
        lastError: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 200,
    });
  }

  audit(tenantId: string) {
    return this.prisma.auditEvent.findMany({
      where: { tenantId },
      select: {
        id: true,
        action: true,
        entityType: true,
        entityId: true,
        employeeId: true,
        deviceId: true,
        metadata: true,
        occurredAt: true,
      },
      orderBy: { occurredAt: 'desc' },
      take: 200,
    });
  }

  async suspend(tenantId: string, reason: string, actor = 'internal-admin') {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, suspendedAt: true },
    });
    if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');
    if (tenant.suspendedAt)
      return { tenantId, suspendedAt: tenant.suspendedAt, alreadySuspended: true };
    const suspendedAt = new Date();
    await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id: tenantId }, data: { suspendedAt } }),
      this.prisma.auditEvent.create({
        data: {
          tenantId,
          action: 'ADMIN_SUSPEND_STORE',
          entityType: 'TENANT',
          entityId: tenantId,
          metadata: {
            reason,
            actor,
            before: 'ACTIVE',
            after: 'SUSPENDED',
            serverTime: suspendedAt.toISOString(),
          },
        },
      }),
    ]);
    return { tenantId, suspendedAt, alreadySuspended: false };
  }

  async unsuspend(tenantId: string, reason: string, actor: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { id: true, suspendedAt: true },
    });
    if (!tenant) throw new NotFoundException('TENANT_NOT_FOUND');
    if (!tenant.suspendedAt) return { tenantId, suspendedAt: null, alreadyActive: true };
    const restoredAt = new Date();
    await this.prisma.$transaction([
      this.prisma.tenant.update({ where: { id: tenantId }, data: { suspendedAt: null } }),
      this.prisma.auditEvent.create({
        data: {
          tenantId,
          action: 'ADMIN_UNSUSPEND_STORE',
          entityType: 'TENANT',
          entityId: tenantId,
          metadata: {
            reason,
            actor,
            before: 'SUSPENDED',
            after: 'ACTIVE',
            serverTime: restoredAt.toISOString(),
          },
        },
      }),
    ]);
    return { tenantId, suspendedAt: null, alreadyActive: false };
  }
}
