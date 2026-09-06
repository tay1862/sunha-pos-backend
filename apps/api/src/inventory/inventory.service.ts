import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { InventoryAdjustmentInput } from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';
import { verifyManager } from '../shifts/shift.service.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.inventoryLevel.findMany({
      where: { item: { store: { tenantId } } },
      include: { item: true, movements: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }

  async adjust(tenantId: string, actorId: string, input: InventoryAdjustmentInput) {
    await verifyManager(this.prisma, tenantId, input.managerEmployeeId, input.managerPin);
    const actor = await this.prisma.employee.findFirst({ where: { id: actorId, tenantId, active: true } });
    if (!actor) throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    const item = await this.prisma.item.findFirst({
      where: { id: input.itemId, store: { tenantId } },
    });
    if (!item) throw new NotFoundException('ITEM_NOT_FOUND');
    if (!item.trackStock) throw new ConflictException('TRACK_STOCK_DISABLED');
    return this.prisma.$transaction(async (tx) => {
      const quantity = input.quantityBase;
      let level;
      if (quantity.startsWith('-')) {
        const absolute = quantity.slice(1);
        const changed = await tx.inventoryLevel.updateMany({
          where: { itemId: item.id, quantityBase: { gte: absolute } },
          data: { quantityBase: { decrement: absolute } },
        });
        if (changed.count !== 1) throw new ConflictException('INSUFFICIENT_STOCK');
        level = await tx.inventoryLevel.findUniqueOrThrow({ where: { itemId: item.id } });
      } else {
        level = await tx.inventoryLevel.upsert({
          where: { itemId: item.id },
          create: { itemId: item.id, quantityBase: quantity },
          update: { quantityBase: { increment: quantity } },
        });
      }
      await tx.inventoryMovement.create({
        data: { itemId: item.id, quantityBase: input.quantityBase, reason: `ADJUSTMENT:${input.reason.slice(0, 28)}` },
      });
      await tx.auditEvent.create({
        data: { tenantId, employeeId: actor.id, action: 'STOCK_ADJUSTMENT', entityType: 'ITEM', entityId: item.id, metadata: { reason: input.reason, managerEmployeeId: input.managerEmployeeId, quantityBase: input.quantityBase } },
      });
      return level;
    });
  }
}
