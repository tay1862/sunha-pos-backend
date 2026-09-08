import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import {
  checkoutOrderSchema,
  cashMovementSchema,
  closeShiftSchema,
  openShiftSchema,
} from '@sunha/contracts';
import type { SyncPushInput } from '@sunha/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';
import { OrderService } from '../orders/order.service.js';
import { ShiftService } from '../shifts/shift.service.js';

type SyncResult = { operationId: string; status: 'ACKED' | 'FAILED_REVIEW'; error?: string };

@Injectable()
export class SyncService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orders: OrderService,
    private readonly shifts: ShiftService,
  ) {}

  async push(tenantId: string, input: SyncPushInput) {
    const device = await this.prisma.device.findFirst({
      where: { id: input.deviceId, tenantId, status: 'ACTIVE' },
    });
    const employee = await this.prisma.employee.findFirst({
      where: { id: input.employeeId, tenantId, active: true, storeId: device?.storeId },
    });
    if (!device || !employee) throw new UnauthorizedException('DEVICE_OR_EMPLOYEE_NOT_ALLOWED');
    const results: SyncResult[] = [];
    for (const operation of orderOperations(input.operations)) {
      const existing = await this.prisma.syncOperation.findUnique({
        where: { operationId: operation.operationId },
      });
      if (existing) {
        results.push({
          operationId: operation.operationId,
          status: existing.status === 'ACKED' ? 'ACKED' : 'FAILED_REVIEW',
          ...(existing.lastError ? { error: existing.lastError } : {}),
        });
        continue;
      }
      const now = new Date();
      let status: 'ACKED' | 'FAILED_REVIEW' = 'ACKED';
      let errorCode: string | undefined;
      try {
        if (operation.type === 'CHECKOUT_ORDER' && operation.payload.offline === true)
          await this.requireOfflinePolicy(device.id, device.storeId);
        await this.applyOperation(tenantId, input.employeeId, input.deviceId, operation);
      } catch (error) {
        status = 'FAILED_REVIEW';
        errorCode = errorCodeFrom(error);
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
          status,
          attemptCount: 1,
          lastAttemptAt: now,
          lastError: errorCode,
          nextRetryAt:
            status === 'FAILED_REVIEW' ? new Date(now.getTime() + retryDelayMs(1)) : null,
        },
      });
      results.push({
        operationId: operation.operationId,
        status,
        ...(errorCode ? { error: errorCode } : {}),
      });
    }
    await this.prisma.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });
    return { results, cursor: newCursor() };
  }

  async pull(tenantId: string, cursor?: string) {
    const decoded = decodeCursor(cursor);
    const operations = await this.prisma.syncOperation.findMany({
      where: {
        tenantId,
        status: 'ACKED',
        ...(decoded
          ? {
              OR: [
                { createdAt: { gt: decoded.createdAt } },
                { createdAt: decoded.createdAt, id: { gt: decoded.id } },
              ],
            }
          : {}),
      },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      take: 100,
    });
    const last = operations.at(-1);
    return {
      operations,
      cursor: last ? encodeCursor(last.createdAt, last.id) : (cursor ?? newCursor()),
    };
  }

  async list(tenantId: string, status?: 'PENDING' | 'ACKED' | 'FAILED_REVIEW') {
    return this.prisma.syncOperation.findMany({
      where: { tenantId, ...(status ? { status } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 200,
      select: {
        operationId: true,
        type: true,
        status: true,
        attemptCount: true,
        lastError: true,
        nextRetryAt: true,
        occurredAtDevice: true,
        createdAt: true,
      },
    });
  }

  async retry(tenantId: string, operationId: string) {
    const operation = await this.prisma.syncOperation.findFirst({
      where: { tenantId, operationId },
    });
    if (!operation) throw new ConflictException('SYNC_OPERATION_NOT_FOUND');
    if (operation.status === 'ACKED') return operation;
    const attempt = operation.attemptCount + 1;
    try {
      const device = await this.prisma.device.findUnique({ where: { id: operation.deviceId } });
      if (!device) throw new ConflictException('DEVICE_NOT_FOUND');
      if (
        operation.type === 'CHECKOUT_ORDER' &&
        operation.payload &&
        typeof operation.payload === 'object' &&
        (operation.payload as { offline?: unknown }).offline === true
      )
        await this.requireOfflinePolicy(device.id, device.storeId);
      await this.applyOperation(tenantId, operation.employeeId, operation.deviceId, {
        operationId: operation.operationId,
        type: operation.type as SyncPushInput['operations'][number]['type'],
        occurredAtDevice: operation.occurredAtDevice.toISOString(),
        payload: operation.payload as Record<string, unknown>,
      });
      return this.prisma.syncOperation.update({
        where: { id: operation.id },
        data: {
          status: 'ACKED',
          attemptCount: attempt,
          lastAttemptAt: new Date(),
          lastError: null,
          nextRetryAt: null,
        },
      });
    } catch (error) {
      return this.prisma.syncOperation.update({
        where: { id: operation.id },
        data: {
          status: 'FAILED_REVIEW',
          attemptCount: attempt,
          lastAttemptAt: new Date(),
          lastError: errorCodeFrom(error),
          nextRetryAt: new Date(Date.now() + retryDelayMs(attempt)),
        },
      });
    }
  }

  private async requireOfflinePolicy(deviceId: string, storeId: string) {
    const device = await this.prisma.device.findUnique({ where: { id: deviceId } });
    if (!device || device.status !== 'ACTIVE') throw new ConflictException('DEVICE_REVOKED');
    if (!device.offlineLeaseExpiresAt || device.offlineLeaseExpiresAt <= new Date())
      throw new ConflictException('OFFLINE_LEASE_EXPIRED');
    if ((await this.prisma.device.count({ where: { storeId, status: 'ACTIVE' } })) > 1)
      throw new ConflictException('MULTI_DEVICE_OFFLINE_FORBIDDEN');
  }

  private async applyOperation(
    tenantId: string,
    employeeId: string,
    deviceId: string,
    operation: SyncPushInput['operations'][number],
  ) {
    if (operation.type === 'CHECKOUT_ORDER')
      return this.orders.checkout(
        tenantId,
        employeeId,
        { ...checkoutOrderSchema.parse(operation.payload), offline: true },
        deviceId,
      );
    if (operation.type === 'OPEN_SHIFT')
      return this.shifts.open(
        tenantId,
        employeeId,
        deviceId,
        openShiftSchema.parse(operation.payload),
      );
    if (operation.type === 'CASH_MOVEMENT')
      return this.shifts.movement(
        tenantId,
        employeeId,
        deviceId,
        cashMovementSchema.parse(operation.payload),
      );
    return this.shifts.close(
      tenantId,
      employeeId,
      deviceId,
      closeShiftSchema.parse(operation.payload),
    );
  }
}

export function orderOperations<T extends { occurredAtDevice: string; operationId: string }>(
  operations: T[],
): T[] {
  return [...operations].sort(
    (a, b) =>
      a.occurredAtDevice.localeCompare(b.occurredAtDevice) ||
      a.operationId.localeCompare(b.operationId),
  );
}
export function retryDelayMs(attempt: number): number {
  return Math.min(60 * 60 * 1000, 1000 * 2 ** Math.max(0, attempt - 1));
}
function errorCodeFrom(error: unknown): string {
  if (error instanceof ConflictException || error instanceof UnauthorizedException) {
    const response = error.getResponse();
    return typeof response === 'string' ? response : error.message;
  }
  return error instanceof Error ? error.message : 'SYNC_FAILED';
}
function encodeCursor(createdAt: Date, id: string): string {
  return Buffer.from(JSON.stringify({ createdAt: createdAt.toISOString(), id }), 'utf8').toString(
    'base64url',
  );
}
function decodeCursor(cursor?: string): { createdAt: Date; id: string } | null {
  if (!cursor) return null;
  try {
    const value = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8')) as {
      createdAt: string;
      id: string;
    };
    return { createdAt: new Date(value.createdAt), id: value.id };
  } catch {
    const date = new Date(cursor);
    return Number.isNaN(date.getTime()) ? null : { createdAt: date, id: '' };
  }
}
function newCursor(): string {
  return encodeCursor(new Date(), '');
}
