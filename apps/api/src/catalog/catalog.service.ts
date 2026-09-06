import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CreateCategoryInput, CreateItemInput, UpdateItemInput } from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class CatalogService {
  constructor(private readonly prisma: PrismaService) {}

  listCategories(tenantId: string) {
    return this.prisma.category.findMany({
      where: { store: { tenantId }, active: true },
      orderBy: { name: 'asc' },
    });
  }

  listItems(tenantId: string) {
    return this.prisma.item.findMany({
      where: { store: { tenantId }, active: true },
      include: { category: true, units: true, inventory: true },
      orderBy: { name: 'asc' },
    });
  }

  async createCategory(tenantId: string, input: CreateCategoryInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    return this.prisma.category.create({
      data: { name: input.name, color: input.color, storeId: store.id },
    });
  }

  async createItem(tenantId: string, input: CreateItemInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    const { units, cost, baseUnitName, ...item } = input;
    const created = await this.prisma.item.create({
      data: {
        ...item,
        storeId: store.id,
        costAmount: cost ? BigInt(cost.amount) : null,
        units: {
          create: units.map((unit) => ({
            name: unit.name,
            multiplierToBase: unit.multiplierToBase,
            priceAmount: BigInt(unit.price.amount),
            sku: unit.sku,
            barcode: unit.barcode,
          })),
        },
        inventory: input.trackStock ? { create: { quantityBase: 0 } } : undefined,
      },
      include: { units: true, category: true, inventory: true },
    });
    return { ...created, baseUnitName };
  }

  async deleteCategory(tenantId: string, id: string) {
    const category = await this.prisma.category.findFirst({
      where: { id, store: { tenantId } },
      include: { _count: { select: { items: true } } },
    });
    if (!category) throw new NotFoundException('CATEGORY_NOT_FOUND');
    if (category._count.items > 0) throw new ConflictException('CATEGORY_HAS_ITEMS');
    await this.prisma.category.update({ where: { id }, data: { active: false } });
    return { success: true };
  }

  async updateItem(tenantId: string, id: string, input: UpdateItemInput) {
    const item = await this.prisma.item.findFirst({ where: { id, store: { tenantId } } });
    if (!item) throw new NotFoundException('ITEM_NOT_FOUND');
    return this.prisma.item.update({
      where: { id },
      data: {
        name: input.name,
        categoryId: input.categoryId,
        trackStock: input.trackStock,
        imageUrl: input.imageUrl,
        costAmount: input.cost ? BigInt(input.cost.amount) : undefined,
      },
    });
  }
}
