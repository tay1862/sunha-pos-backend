import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import argon2 from 'argon2';
import type { CashMovementInput, CloseShiftInput, OpenShiftInput } from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ShiftService {
  constructor(private readonly prisma: PrismaService) {}

  async open(tenantId: string, employeeId: string, deviceId: string, input: OpenShiftInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    const open = await this.prisma.shift.findFirst({
      where: { storeId: store.id, isOpen: true },
    });
    if (open) throw new ConflictException('SHIFT_ALREADY_OPEN');
    const shift = await this.prisma.shift.create({
      data: { storeId: store.id, employeeId, openingAmount: BigInt(input.openingAmount) },
    });
    await this.audit(tenantId, employeeId, deviceId, 'OPEN_SHIFT', shift.id, {
      openingAmount: input.openingAmount,
    });
    return shift;
  }

  async movement(tenantId: string, employeeId: string, deviceId: string, input: CashMovementInput) {
    const shift = await this.current(tenantId);
    const movement = await this.prisma.cashMovement.create({
      data: {
        shiftId: shift.id,
        employeeId,
        amount: BigInt(input.amount),
        type: input.type,
        reason: input.reason,
      },
    });
    await this.audit(tenantId, employeeId, deviceId, input.type, movement.id, {
      amount: input.amount,
      reason: input.reason,
    });
    return movement;
  }

  async close(tenantId: string, employeeId: string, deviceId: string, input: CloseShiftInput) {
    const shift = await this.current(tenantId);
    const pending = await this.prisma.syncOperation.count({
      where: { tenantId, status: 'PENDING' },
    });
    if (pending > 0) throw new ConflictException('PENDING_OPERATIONS');
    const expected = await this.expectedCash(shift);
    const closed = await this.prisma.shift.update({
      where: { id: shift.id },
      data: { closingAmount: BigInt(input.closingAmount), closedAt: new Date(), isOpen: false },
    });
    await this.audit(tenantId, employeeId, deviceId, 'CLOSE_SHIFT', shift.id, {
      expected: expected.toString(),
      actual: input.closingAmount,
      variance: (BigInt(input.closingAmount) - expected).toString(),
    });
    return {
      ...closed,
      expectedAmount: expected.toString(),
      variance: (BigInt(input.closingAmount) - expected).toString(),
    };
  }

  private async current(tenantId: string) {
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    const shift = store
      ? await this.prisma.shift.findFirst({ where: { storeId: store.id, isOpen: true } })
      : null;
    if (!shift) throw new ConflictException('NO_OPEN_SHIFT');
    return shift;
  }

  private async expectedCash(shift: {
    id: string;
    storeId: string;
    openingAmount: bigint;
    openedAt: Date;
  }) {
    const payments = await this.prisma.payment.aggregate({
      _sum: { amount: true },
      where: {
        type: 'CASH',
        order: { storeId: shift.storeId, createdAt: { gte: shift.openedAt } },
      },
    });
    const movements = await this.prisma.cashMovement.aggregate({
      _sum: { amount: true },
      where: { shiftId: shift.id },
    });
    return shift.openingAmount + (payments._sum.amount ?? 0n) + (movements._sum.amount ?? 0n);
  }

  private audit(
    tenantId: string,
    employeeId: string,
    deviceId: string,
    action: string,
    entityId: string,
    metadata: Record<string, string>,
  ) {
    return this.prisma.auditEvent
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
