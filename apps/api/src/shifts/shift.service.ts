import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { CashMovementInput, CloseShiftInput, OpenShiftInput } from '@sunha/contracts';
import type { Prisma } from '../generated/prisma/client.js';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ShiftService {
  constructor(private readonly prisma: PrismaService) {}

  async open(tenantId: string, employeeId: string, deviceId: string, input: OpenShiftInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockStore(tx, tenantId);
      const store = await tx.store.findUnique({ where: { tenantId } });
      if (!store) throw new NotFoundException('STORE_NOT_FOUND');
      const open = await tx.shift.findFirst({
        where: { storeId: store.id, isOpen: true },
      });
      if (open) throw new ConflictException('SHIFT_ALREADY_OPEN');
      const shift = await tx.shift.create({
        data: { storeId: store.id, employeeId, openingAmount: BigInt(input.openingAmount) },
      });
      await this.audit(tx, tenantId, employeeId, deviceId, 'OPEN_SHIFT', shift.id, {
        openingAmount: input.openingAmount,
      });
      return shift;
    });
  }

  async movement(tenantId: string, employeeId: string, deviceId: string, input: CashMovementInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockStore(tx, tenantId);
      const shift = await this.current(tx, tenantId);
      const movement = await tx.cashMovement.create({
        data: {
          shiftId: shift.id,
          employeeId,
          amount: cashMovementAmount(input),
          type: input.type,
          reason: input.reason,
        },
      });
      await this.audit(tx, tenantId, employeeId, deviceId, input.type, movement.id, {
        amount: input.amount,
        reason: input.reason,
      });
      return movement;
    });
  }

  async close(tenantId: string, employeeId: string, deviceId: string, input: CloseShiftInput) {
    return this.prisma.$transaction(async (tx) => {
      await this.lockStore(tx, tenantId);
      const shift = await this.current(tx, tenantId);
      const pending = await tx.syncOperation.count({
        where: { tenantId, status: 'PENDING' },
      });
      if (pending > 0) throw new ConflictException('PENDING_OPERATIONS');
      const expected = await this.expectedCash(tx, shift);
      const closed = await tx.shift.update({
        where: { id: shift.id },
        data: { closingAmount: BigInt(input.closingAmount), closedAt: new Date(), isOpen: false },
      });
      await this.audit(tx, tenantId, employeeId, deviceId, 'CLOSE_SHIFT', shift.id, {
        expected: expected.toString(),
        actual: input.closingAmount,
        variance: (BigInt(input.closingAmount) - expected).toString(),
      });
      return {
        ...closed,
        expectedAmount: expected.toString(),
        variance: (BigInt(input.closingAmount) - expected).toString(),
      };
    });
  }

  private async lockStore(tx: Prisma.TransactionClient, tenantId: string) {
    const stores = await tx.$queryRaw<
      Array<{ id: string }>
    >`SELECT id FROM "Store" WHERE "tenantId" = ${tenantId}::uuid FOR UPDATE`;
    if (!stores.length) throw new NotFoundException('STORE_NOT_FOUND');
  }

  private async current(tx: Prisma.TransactionClient, tenantId: string) {
    const store = await tx.store.findUnique({ where: { tenantId }, select: { id: true } });
    const shift = store
      ? await tx.shift.findFirst({ where: { storeId: store.id, isOpen: true } })
      : null;
    if (!shift) throw new ConflictException('NO_OPEN_SHIFT');
    return shift;
  }

  private async expectedCash(
    tx: Prisma.TransactionClient,
    shift: {
      id: string;
      storeId: string;
      openingAmount: bigint;
      openedAt: Date;
    },
  ) {
    const payments = await tx.payment.aggregate({
      _sum: { amount: true },
      where: {
        type: 'CASH',
        shiftId: shift.id,
      },
    });
    const movements = await tx.cashMovement.aggregate({
      _sum: { amount: true },
      where: { shiftId: shift.id },
    });
    return shift.openingAmount + (payments._sum.amount ?? 0n) + (movements._sum.amount ?? 0n);
  }

  private audit(
    tx: Prisma.TransactionClient,
    tenantId: string,
    employeeId: string,
    deviceId: string,
    action: string,
    entityId: string,
    metadata: Record<string, string>,
  ) {
    return tx.auditEvent
      .create({
        data: {
          tenantId,
          employeeId,
          deviceId,
          action,
          entityType: 'SHIFT',
          entityId,
          metadata: {
            ...metadata,
            serverTime: new Date().toISOString(),
            actorEmployeeId: employeeId,
            actorDeviceId: deviceId,
          },
        },
      })
      .then(() => undefined);
  }
}

export async function verifyManager(
  prisma: PrismaService,
  tenantId: string,
  employeeId: string,
  pin: string,
): Promise<void> {
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, tenantId, active: true },
  });
  if (!employee || employee.role === 'CASHIER' || !(await argon2.verify(employee.pinHash, pin)))
    throw new UnauthorizedException('MANAGER_APPROVAL_REQUIRED');
}

export function cashMovementAmount(input: CashMovementInput): bigint {
  if (!/^-?\d+$/.test(input.amount)) throw new ConflictException('INVALID_CASH_MOVEMENT_AMOUNT');
  const amount = BigInt(input.amount);
  // Preserve the existing signed API contract; reject contradictory directions.
  if ((input.type === 'CASH_IN' && amount <= 0n) || (input.type === 'CASH_OUT' && amount >= 0n))
    throw new ConflictException('INVALID_CASH_MOVEMENT_AMOUNT');
  return amount;
}
