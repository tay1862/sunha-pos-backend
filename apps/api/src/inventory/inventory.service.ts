import { Injectable, NotFoundException } from '@nestjs/common';
import type { InventoryAdjustmentInput } from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class InventoryService {
  constructor(private readonly prisma: PrismaService) {}

  list(tenantId: string) {
    return this.prisma.inventoryLevel.findMany({
      where: { item: { store: { tenantId } } },
      include: { item: true, movements: { orderBy: { createdAt: 'desc' }, take: 20 } },
    });
  }

  async adjust(tenantId: string, input: InventoryAdjustmentInput) {
    const item = await this.prisma.item.findFirst({
      where: { id: input.itemId, store: { tenantId } },
    });
    if (!item) throw new NotFoundException('ITEM_NOT_FOUND');
    return this.prisma.$transaction(async (tx) => {
      const level = await tx.inventoryLevel.upsert({
        where: { itemId: item.id },
        create: { itemId: item.id, quantityBase: input.quantityBase },
        update: { quantityBase: { increment: input.quantityBase } },
      });
      await tx.inventoryMovement.create({
        data: { itemId: item.id, quantityBase: input.quantityBase, reason: input.reason },
      });
      return level;
    });
  }
}
