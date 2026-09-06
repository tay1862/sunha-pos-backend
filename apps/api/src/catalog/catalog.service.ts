import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  CreateCategoryInput,
  CreateItemInput,
  CreateModifierGroupInput,
  CreateTaxInput,
  UpdateItemInput,
} from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

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

  async snapshot(tenantId: string) {
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true, updatedAt: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    const [categories, items, modifierGroups, taxes] = await Promise.all([
      this.prisma.category.findMany({ where: { storeId: store.id, active: true }, orderBy: { name: 'asc' } }),
      this.prisma.item.findMany({ where: { storeId: store.id, active: true }, include: { category: true, units: { where: { active: true } }, modifierGroups: { include: { group: { include: { options: true } } } }, inventory: true }, orderBy: { name: 'asc' } }),
      this.prisma.modifierGroup.findMany({ where: { storeId: store.id }, include: { options: true }, orderBy: { name: 'asc' } }),
      this.prisma.tax.findMany({ where: { storeId: store.id, active: true }, orderBy: { name: 'asc' } }),
    ]);
    return { version: store.updatedAt.toISOString(), categories, items, modifierGroups, taxes };
  }

  async createCategory(tenantId: string, input: CreateCategoryInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    try {
      return await this.prisma.category.create({
        data: { name: input.name, color: input.color, storeId: store.id },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('CATEGORY_NAME_ALREADY_EXISTS');
      throw error;
    }
  }

  async createItem(tenantId: string, input: CreateItemInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    const { units, cost, baseUnitName, ...item } = input;
    if (input.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: input.categoryId, storeId: store.id, active: true } });
      if (!category) throw new NotFoundException('CATEGORY_NOT_FOUND');
    }
    let created;
    try {
      created = await this.prisma.item.create({
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
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002')
        throw new ConflictException('SKU_OR_BARCODE_ALREADY_EXISTS');
      throw error;
    }
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
    if (input.categoryId) {
      const category = await this.prisma.category.findFirst({ where: { id: input.categoryId, storeId: item.storeId, active: true } });
      if (!category) throw new NotFoundException('CATEGORY_NOT_FOUND');
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const updated = await tx.item.update({
          where: { id },
          data: {
            name: input.name,
            categoryId: input.categoryId,
            trackStock: input.trackStock,
            imageUrl: input.imageUrl,
            costAmount: input.cost ? BigInt(input.cost.amount) : undefined,
          },
        });
        if (input.units) {
          for (const unit of input.units) {
            if (unit.id) {
              const existing = await tx.itemUnit.findFirst({ where: { id: unit.id, itemId: id } });
              if (!existing) throw new NotFoundException('UNIT_NOT_FOUND');
              await tx.itemUnit.update({ where: { id: unit.id }, data: { name: unit.name, multiplierToBase: unit.multiplierToBase, priceAmount: BigInt(unit.price.amount), sku: unit.sku, barcode: unit.barcode } });
            } else {
              await tx.itemUnit.create({ data: { itemId: id, name: unit.name, multiplierToBase: unit.multiplierToBase, priceAmount: BigInt(unit.price.amount), sku: unit.sku, barcode: unit.barcode } });
            }
          }
        }
        return updated;
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') throw new ConflictException('SKU_OR_BARCODE_ALREADY_EXISTS');
      throw error;
    }
  }

  async deleteItem(tenantId: string, id: string) {
    const item = await this.prisma.item.findFirst({ where: { id, store: { tenantId }, active: true } });
    if (!item) throw new NotFoundException('ITEM_NOT_FOUND');
    await this.prisma.item.update({ where: { id }, data: { active: false } });
    return { success: true };
  }

  listModifierGroups(tenantId: string) {
    return this.prisma.modifierGroup.findMany({
      where: { store: { tenantId } },
      include: { options: true },
      orderBy: { name: 'asc' },
    });
  }

  async createModifierGroup(tenantId: string, input: CreateModifierGroupInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    if (input.minSelections > input.maxSelections) throw new ConflictException('INVALID_MODIFIER_LIMITS');
    return this.prisma.modifierGroup.create({
      data: {
        storeId: store.id,
        name: input.name,
        required: input.required,
        minSelections: input.minSelections,
        maxSelections: input.maxSelections,
        options: {
          create: input.options.map((option) => ({ name: option.name, priceDeltaAmount: BigInt(option.priceDelta.amount) })),
        },
      },
      include: { options: true },
    });
  }

  async assignModifierGroup(tenantId: string, itemId: string, groupId: string) {
    const item = await this.prisma.item.findFirst({ where: { id: itemId, store: { tenantId }, active: true } });
    const group = await this.prisma.modifierGroup.findFirst({ where: { id: groupId, store: { tenantId } } });
    if (!item || !group) throw new NotFoundException('ITEM_OR_MODIFIER_GROUP_NOT_FOUND');
    return this.prisma.itemModifierGroup.upsert({
      where: { itemId_groupId: { itemId, groupId } },
      create: { itemId, groupId },
      update: {},
    });
  }

  listTaxes(tenantId: string) {
    return this.prisma.tax.findMany({ where: { store: { tenantId }, active: true }, orderBy: { name: 'asc' } });
  }

  async createTax(tenantId: string, input: CreateTaxInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId }, select: { id: true } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    return this.prisma.tax.create({ data: { storeId: store.id, ...input } });
  }
}
