import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import argon2 from 'argon2';
import { Prisma } from '../generated/prisma/client.js';
import { toBaseQuantity } from '@sunha/domain';
import type { RefundInput } from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class RefundService {
  constructor(private readonly prisma: PrismaService) {}
  async refund(tenantId: string, cashierId: string, deviceId: string, input: RefundInput) {
    const manager = await this.prisma.employee.findFirst({
      where: { id: input.managerEmployeeId, tenantId, active: true },
    });
    if (
      !manager ||
      manager.role === 'CASHIER' ||
      !(await argon2.verify(manager.pinHash, input.managerPin))
    )
      throw new ConflictException('MANAGER_APPROVAL_REQUIRED');
    const order = await this.prisma.order.findFirst({
      where: { id: input.orderId, tenantId },
      include: { refunds: true, lines: true },
    });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    if (
      order.status === 'REFUNDED' &&
      order.refunds[0]?.reason === input.reason &&
      order.refunds[0]?.managerEmployeeId === manager.id
    )
      return order.refunds[0];
    if (order.status !== 'COMPLETED' || order.refunds.length)
      throw new ConflictException('ORDER_NOT_REFUNDABLE');
    try {
      const result = await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM "Store" WHERE id = ${order.storeId}::uuid FOR UPDATE`;
        const prior = await tx.refund.findUnique({ where: { orderId: order.id } });
        if (prior) {
          if (prior.reason !== input.reason || prior.managerEmployeeId !== manager.id)
            throw new ConflictException('ORDER_NOT_REFUNDABLE');
          return prior;
        }
        const activeShift = await tx.shift.findFirst({
          where: { storeId: order.storeId, isOpen: true },
          select: { id: true },
        });
        if (!activeShift) throw new ConflictException('NO_OPEN_SHIFT');
        for (const line of order.lines) {
          const level = await tx.inventoryLevel.findUnique({ where: { itemId: line.itemId } });
          if (level) {
            const restored = refundQuantity(
              line.quantity.toString(),
              line.multiplierSnapshot.toString(),
            );
            await tx.inventoryLevel.update({
              where: { itemId: line.itemId },
              data: { quantityBase: { increment: restored } },
            });
            await tx.inventoryMovement.create({
              data: {
                itemId: line.itemId,
                quantityBase: restored,
                reason: 'REFUND',
                referenceId: order.id,
              },
            });
          }
        }
        const refund = await tx.refund.create({
          data: {
            orderId: order.id,
            shiftId: activeShift?.id,
            managerEmployeeId: manager.id,
            amount: order.totalAmount,
            reason: input.reason,
          },
        });
        const originalPayment = await tx.payment.findFirst({
          where: { orderId: order.id },
          orderBy: { createdAt: 'asc' },
        });
        if (originalPayment) {
          await tx.payment.create({
            data: {
              orderId: order.id,
              shiftId: activeShift?.id,
              type: originalPayment.type,
              amount: -originalPayment.amount,
              reference: `REFUND:${order.id}`,
              unverified: originalPayment.unverified,
            },
          });
        }
        await tx.order.update({ where: { id: order.id }, data: { status: 'REFUNDED' } });
        await tx.auditEvent.create({
          data: {
            tenantId,
            employeeId: cashierId,
            deviceId,
            action: 'REFUND',
            entityType: 'ORDER',
            entityId: order.id,
            metadata: {
              managerEmployeeId: manager.id,
              reason: input.reason,
              serverTime: new Date().toISOString(),
              actorDeviceId: deviceId,
            },
          },
        });
        return refund;
      });
      return result;
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const existing = await this.prisma.refund.findUnique({ where: { orderId: order.id } });
        if (existing) return existing;
      }
      throw error;
    }
  }
}

export function refundQuantity(quantity: string, multiplier: string): string {
  return toBaseQuantity(quantity, multiplier);
}
