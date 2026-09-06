import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import argon2 from 'argon2';
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
    if (order.status !== 'COMPLETED' || order.refunds.length)
      throw new ConflictException('ORDER_NOT_REFUNDABLE');
    const result = await this.prisma.$transaction(async (tx) => {
      for (const line of order.lines) {
        const level = await tx.inventoryLevel.findUnique({ where: { itemId: line.itemId } });
        if (level) {
          const restored = multiplyQuantity(
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
          managerEmployeeId: manager.id,
          amount: order.totalAmount,
          reason: input.reason,
        },
      });
      const originalPayment = await tx.payment.findFirst({ where: { orderId: order.id }, orderBy: { createdAt: 'asc' } });
      if (originalPayment) {
        await tx.payment.create({
          data: {
            orderId: order.id,
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
          metadata: { managerEmployeeId: manager.id, reason: input.reason, serverTime: new Date().toISOString(), actorDeviceId: deviceId },
        },
      });
      return refund;
    });
    return result;
  }
}

function multiplyQuantity(quantity: string, multiplier: string): string {
  const scaled = (value: string) => {
    const [whole = '0', fraction = ''] = value.split('.');
    return BigInt(whole) * 1000n + BigInt(fraction.padEnd(3, '0'));
  };
  const value = (scaled(quantity) * scaled(multiplier)) / 1000n;
  const whole = value / 1000n;
  const fraction = (value % 1000n).toString().padStart(3, '0').replace(/0+$/, '');
  return fraction ? `${whole}.${fraction}` : whole.toString();
}
