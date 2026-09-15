import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import type { CheckoutOrderInput, OrderQuoteInput } from '@sunha/contracts';
import { calculateOrderTotals, toBaseQuantity } from '@sunha/domain';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}
  async checkout(
    tenantId: string,
    employeeId: string,
    input: CheckoutOrderInput,
    deviceId?: string,
  ) {
    const existing = await this.prisma.order.findUnique({
      where: { clientOrderId: input.clientOrderId },
      include: { receipts: true, payments: true },
    });
    if (existing) {
      if (existing.tenantId !== tenantId) throw new ConflictException('ORDER_ID_ALREADY_USED');
      if (existing.requestHash && existing.requestHash !== checkoutRequestHash(input))
        throw new ConflictException('CHECKOUT_PAYLOAD_CONFLICT');
      return existing;
    }
    const store = await this.prisma.store.findUnique({ where: { tenantId } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    if (input.catalogVersion && input.catalogVersion !== store.catalogVersion.toString())
      throw new ConflictException('CATALOG_VERSION_MISMATCH');
    if (input.offline) {
      if (!deviceId) throw new ConflictException('OFFLINE_DEVICE_REQUIRED');
      const device = await this.prisma.device.findFirst({
        where: { id: deviceId, tenantId, storeId: store.id, status: 'ACTIVE' },
      });
      if (!device || !device.offlineLeaseExpiresAt || device.offlineLeaseExpiresAt <= new Date())
        throw new ConflictException('OFFLINE_LEASE_EXPIRED');
      const activeDevices = await this.prisma.device.count({
        where: { storeId: store.id, status: 'ACTIVE' },
      });
      if (activeDevices > 1) throw new ConflictException('MULTI_DEVICE_OFFLINE_FORBIDDEN');
    }
    const employee = await this.prisma.employee.findFirst({
      where: { id: employeeId, tenantId, active: true },
    });
    if (!employee) throw new NotFoundException('EMPLOYEE_NOT_FOUND');
    const taxes = await this.prisma.tax.findMany({
      where: { storeId: store.id, active: true },
      select: { rateBasisPoints: true, mode: true },
    });
    const taxModes = new Set(taxes.map((tax) => tax.mode));
    if (taxModes.size > 1) throw new ConflictException('MIXED_TAX_MODES_NOT_SUPPORTED');
    const effectiveTaxRate = taxes.reduce((sum, tax) => sum + tax.rateBasisPoints, 0);
    const effectiveTaxMode = taxes[0]?.mode === 'INCLUSIVE' ? 'INCLUSIVE' : 'EXCLUSIVE';
    const units = await this.prisma.itemUnit.findMany({
      where: {
        id: { in: input.lines.map((line) => line.unitId) },
        active: true,
        item: { active: true, store: { tenantId } },
      },
      include: { item: { include: { modifierGroups: { include: { group: true } } } } },
    });
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    const resolved = input.lines.map((line) => {
      const unit = byId.get(line.unitId);
      if (!unit || unit.itemId !== line.itemId) throw new ConflictException('INVALID_ORDER_LINE');
      return { line, unit };
    });
    const optionIds = [...new Set(input.lines.flatMap((line) => line.modifierOptionIds))];
    const options = await this.prisma.modifierOption.findMany({
      where: { id: { in: optionIds }, group: { store: { tenantId } } },
      include: { group: true },
    });
    if (options.length !== optionIds.length) throw new ConflictException('INVALID_MODIFIERS');
    const optionsById = new Map(options.map((option) => [option.id, option]));
    const resolvedWithModifiers = resolved.map(({ line, unit }) => {
      const selectedIds = line.modifierOptionIds;
      if (new Set(selectedIds).size !== selectedIds.length)
        throw new ConflictException('INVALID_MODIFIERS');
      const assignedGroups = new Map(
        unit.item.modifierGroups.map((assignment) => [assignment.groupId, assignment.group]),
      );
      const selected = selectedIds.map((id) => optionsById.get(id));
      if (selected.some((option) => !option || !assignedGroups.has(option.groupId)))
        throw new ConflictException('INVALID_MODIFIERS');
      for (const group of assignedGroups.values()) {
        const count = selected.filter((option) => option?.groupId === group.id).length;
        if (
          count < group.minSelections ||
          count > group.maxSelections ||
          (group.required && count === 0)
        )
          throw new ConflictException('INVALID_MODIFIERS');
      }
      const effectiveUnitPrice = modifierUnitPrice(
        unit.priceAmount.toString(),
        selected.map((option) => option?.priceDeltaAmount.toString() ?? '0'),
      );
      return {
        line,
        unit,
        selected: selected.filter((option): option is NonNullable<typeof option> =>
          Boolean(option),
        ),
        effectiveUnitPrice,
      };
    });
    const totals = calculateTotals({
      lines: resolvedWithModifiers.map(({ line, effectiveUnitPrice }) => ({
        unitPrice: effectiveUnitPrice.toString(),
        quantity: line.quantity,
      })),
      discount: input.discount,
      taxRateBasisPoints: effectiveTaxRate,
      taxMode: effectiveTaxMode,
    });
    const payment = calculatePaymentAmounts(
      input.paymentType,
      totals.total,
      input.tenderedAmount?.amount,
    );
    const receiptNumber = `SUNHA-${input.clientOrderId}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
        // Serialize checkout with closing a shift. The store row is the lock
        // representing the one shared cash drawer for this store.
        await tx.$queryRaw`SELECT id FROM "Store" WHERE id = ${store.id}::uuid FOR UPDATE`;
        const activeShift = await tx.shift.findFirst({
          where: { storeId: store.id, isOpen: true },
          select: { id: true },
        });
        if (!activeShift) throw new ConflictException('NO_OPEN_SHIFT');
        for (const { line, unit } of resolvedWithModifiers) {
          if (!unit.item.trackStock) continue;
          const required = baseQuantity(line.quantity, unit.multiplierToBase.toString());
          const changed = await tx.inventoryLevel.updateMany({
            where: { itemId: unit.itemId, quantityBase: { gte: required } },
            data: { quantityBase: { decrement: required } },
          });
          if (changed.count !== 1) throw new ConflictException('INSUFFICIENT_STOCK');
          await tx.inventoryMovement.create({
            data: { itemId: unit.itemId, quantityBase: `-${required}`, reason: 'SALE' },
          });
        }
        return tx.order.create({
          data: {
            clientOrderId: input.clientOrderId,
            requestHash: checkoutRequestHash(input),
            tenantId,
            storeId: store.id,
            employeeId,
            deviceId,
            shiftId: activeShift?.id,
            status: 'COMPLETED',
            subtotalAmount: BigInt(totals.subtotal),
            discountAmount: BigInt(totals.discount),
            taxAmount: BigInt(totals.tax),
            totalAmount: BigInt(totals.total),
            currency: 'LAK',
            offline: input.offline,
            completedAt: new Date(),
            lines: {
              create: resolvedWithModifiers.map(({ line, unit, selected, effectiveUnitPrice }) => ({
                itemId: line.itemId,
                unitId: unit.id,
                itemNameSnapshot: unit.item.name,
                unitNameSnapshot: unit.name,
                quantity: line.quantity,
                multiplierSnapshot: unit.multiplierToBase,
                unitPriceAmount: effectiveUnitPrice,
                lineTotalAmount: BigInt(
                  calculateTotals({
                    lines: [{ unitPrice: effectiveUnitPrice.toString(), quantity: line.quantity }],
                    taxRateBasisPoints: 0,
                  }).subtotal,
                ),
                note: line.note,
                modifiers: {
                  create: selected.map((option) => ({
                    optionId: option.id,
                    nameSnapshot: option.name,
                    priceDeltaSnapshot: option.priceDeltaAmount,
                  })),
                },
              })),
            },
            payments: {
              create: {
                type: input.paymentType,
                shiftId: activeShift?.id,
                amount: BigInt(totals.total),
                tenderedAmount: payment.tenderedAmount,
                changeAmount: payment.changeAmount,
                reference: input.paymentReference,
                unverified: input.paymentType === 'MANUAL_QR',
              },
            },
            receipts: { create: { number: receiptNumber } },
          },
          include: { receipts: true, payments: true },
        });
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
        const concurrent = await this.prisma.order.findUnique({
          where: { clientOrderId: input.clientOrderId },
          include: { receipts: true, payments: true },
        });
        if (concurrent?.tenantId === tenantId) return concurrent;
        throw new ConflictException('ORDER_ID_ALREADY_USED');
      }
      throw error;
    }
  }

  async quote(tenantId: string, input: OrderQuoteInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    if (input.catalogVersion && input.catalogVersion !== store.catalogVersion.toString())
      throw new ConflictException('CATALOG_VERSION_MISMATCH');
    const units = await this.prisma.itemUnit.findMany({
      where: {
        id: { in: input.lines.map((line) => line.unitId) },
        active: true,
        item: { active: true, storeId: store.id },
      },
    });
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    const optionIds = [...new Set(input.lines.flatMap((line) => line.modifierOptionIds))];
    const options = optionIds.length
      ? await this.prisma.modifierOption.findMany({
          where: { id: { in: optionIds }, group: { storeId: store.id } },
        })
      : [];
    if (options.length !== optionIds.length) throw new ConflictException('INVALID_MODIFIERS');
    const optionsById = new Map(options.map((option) => [option.id, option]));
    const lines = input.lines.map((line) => {
      const unit = byId.get(line.unitId);
      if (!unit || unit.itemId !== line.itemId) throw new ConflictException('INVALID_ORDER_LINE');
      const modifierTotal = line.modifierOptionIds.reduce(
        (sum, id) => sum + (optionsById.get(id)?.priceDeltaAmount ?? 0n),
        0n,
      );
      return { unitPrice: (unit.priceAmount + modifierTotal).toString(), quantity: line.quantity };
    });
    const taxes = await this.prisma.tax.findMany({
      where: { storeId: store.id, active: true },
      select: { rateBasisPoints: true, mode: true },
    });
    const modes = new Set(taxes.map((tax) => tax.mode));
    if (modes.size > 1) throw new ConflictException('MIXED_TAX_MODES_NOT_SUPPORTED');
    const totals = calculateTotals({
      lines,
      discount: input.discount,
      taxRateBasisPoints: taxes.reduce((sum, tax) => sum + tax.rateBasisPoints, 0),
      taxMode: taxes[0]?.mode as 'INCLUSIVE' | 'EXCLUSIVE' | undefined,
    });
    return { catalogVersion: store.catalogVersion.toString(), ...totals };
  }
}

function calculateTotals(input: {
  lines: Array<{ unitPrice: string; quantity: string }>;
  discount?: { type: 'FIXED'; amount: string } | { type: 'PERCENTAGE'; basisPoints: number };
  taxRateBasisPoints: number;
  taxMode?: 'INCLUSIVE' | 'EXCLUSIVE';
}): { subtotal: string; discount: string; tax: string; total: string } {
  return calculateOrderTotals({
    lines: input.lines,
    discount: input.discount,
    tax:
      input.taxRateBasisPoints > 0
        ? { rateBasisPoints: input.taxRateBasisPoints, mode: input.taxMode ?? 'EXCLUSIVE' }
        : undefined,
  });
}

function baseQuantity(quantity: string, multiplier: string): string {
  return toBaseQuantity(quantity, multiplier);
}

export { baseQuantity, calculateTotals };

function calculatePaymentAmounts(
  paymentType: CheckoutOrderInput['paymentType'],
  total: string,
  tendered?: string,
) {
  if (paymentType !== 'CASH') return { tenderedAmount: null, changeAmount: null };
  if (!tendered || BigInt(tendered) < BigInt(total))
    throw new ConflictException('INSUFFICIENT_TENDER');
  return { tenderedAmount: BigInt(tendered), changeAmount: BigInt(tendered) - BigInt(total) };
}

export { calculatePaymentAmounts };

function modifierUnitPrice(basePrice: string, deltas: string[]): bigint {
  const total = deltas.reduce((sum, delta) => sum + BigInt(delta), BigInt(basePrice));
  if (total < 0n) throw new ConflictException('INVALID_MODIFIER_PRICE');
  return total;
}

export { modifierUnitPrice };

export function checkoutRequestHash(input: CheckoutOrderInput): string {
  return createHash('sha256')
    .update(
      JSON.stringify(input, (_key, value: unknown) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
          return Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)));
        }
        return value;
      }),
    )
    .digest('hex');
}
