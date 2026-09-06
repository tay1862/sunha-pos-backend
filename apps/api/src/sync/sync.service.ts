import { Injectable, UnauthorizedException } from '@nestjs/common';
import type { SyncPushInput } from '@sunha/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
@Injectable()
export class SyncService {
  constructor(private readonly prisma: PrismaService) {}
  async push(tenantId: string, input: SyncPushInput) {
    const device = await this.prisma.device.findFirst({
      where: { id: input.deviceId, tenantId, status: 'ACTIVE' },
    });
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, tenantId, active: true },
    });
    if (!device || !employee) throw new UnauthorizedException('DEVICE_OR_EMPLOYEE_NOT_ALLOWED');
    const results: Array<{
      operationId: string;
      status: 'ACKED' | 'FAILED_REVIEW';
      error?: string;
    }> = [];
    for (const operation of input.operations) {
      try {
        const offline = operation.type === 'CHECKOUT_ORDER' && operation.payload.offline === true;
        if (
          offline &&
          (!device.offlineLeaseExpiresAt || device.offlineLeaseExpiresAt <= new Date())
        ) {
          results.push({
            operationId: operation.operationId,
            status: 'FAILED_REVIEW',
            error: 'OFFLINE_LEASE_EXPIRED',
          });
          continue;
        }
        await this.prisma.syncOperation.create({
          data: {
            operationId: operation.operationId,
            tenantId,
            deviceId: input.deviceId,
            employeeId: input.employeeId,
            type: operation.type,
            payload: operation.payload as Prisma.InputJsonValue,
            occurredAtDevice: new Date(operation.occurredAtDevice),
            status: 'ACKED',
          },
        });
        results.push({ operationId: operation.operationId, status: 'ACKED' });
      } catch (error) {
        const duplicate = await this.prisma.syncOperation.findUnique({
          where: { operationId: operation.operationId },
        });
        results.push(
          duplicate?.tenantId === tenantId
            ? {
                operationId: operation.operationId,
                status: duplicate.status === 'ACKED' ? 'ACKED' : 'FAILED_REVIEW',
              }
            : {
                operationId: operation.operationId,
                status: 'FAILED_REVIEW',
                error: error instanceof Error ? error.message : 'SYNC_FAILED',
              },
        );
      }
    }
    await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return { results, cursor: new Date().toISOString() };
  }
  async pull(tenantId: string, cursor?: string) {
    const since = cursor ? new Date(cursor) : new Date(0);
    const operations = await this.prisma.syncOperation.findMany({
      where: { tenantId, createdAt: { gt: since }, status: 'ACKED' },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
    return {
      operations,
      cursor: operations.at(-1)?.createdAt.toISOString() ?? cursor ?? new Date().toISOString(),
    };
  }
}
