import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CheckoutOrderInput } from '@sunha/contracts';
import { calculateOrderTotals, toBaseQuantity } from '@sunha/domain';
import { PrismaService } from '../database/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}
  async checkout(tenantId: string, employeeId: string, input: CheckoutOrderInput, deviceId?: string) {
    const existing = await this.prisma.order.findUnique({
      where: { clientOrderId: input.clientOrderId },
      include: { receipts: true, payments: true },
    });
    if (existing) {
      if (existing.tenantId !== tenantId) throw new ConflictException('ORDER_ID_ALREADY_USED');
      return existing;
    }
    const store = await this.prisma.store.findUnique({ where: { tenantId } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
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
      where: { id: { in: input.lines.map((line) => line.unitId) }, item: { store: { tenantId } } },
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
      if (new Set(selectedIds).size !== selectedIds.length) throw new ConflictException('INVALID_MODIFIERS');
      const assignedGroups = new Map(unit.item.modifierGroups.map((assignment) => [assignment.groupId, assignment.group]));
      const selected = selectedIds.map((id) => optionsById.get(id));
      if (selected.some((option) => !option || !assignedGroups.has(option.groupId)))
        throw new ConflictException('INVALID_MODIFIERS');
      for (const group of assignedGroups.values()) {
        const count = selected.filter((option) => option?.groupId === group.id).length;
        if (count < group.minSelections || count > group.maxSelections || (group.required && count === 0))
          throw new ConflictException('INVALID_MODIFIERS');
      }
    const effectiveUnitPrice = modifierUnitPrice(unit.priceAmount.toString(), selected.map((option) => option?.priceDeltaAmount.toString() ?? '0'));
      return { line, unit, selected: selected.filter((option): option is NonNullable<typeof option> => Boolean(option)), effectiveUnitPrice };
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
    const payment = calculatePaymentAmounts(input.paymentType, totals.total, input.tenderedAmount?.amount);
    const receiptNumber = `SUNHA-${input.clientOrderId}`;
    try {
      return await this.prisma.$transaction(async (tx) => {
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
          tenantId,
          storeId: store.id,
          employeeId,
          deviceId,
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

function calculatePaymentAmounts(paymentType: CheckoutOrderInput['paymentType'], total: string, tendered?: string) {
  if (paymentType !== 'CASH') return { tenderedAmount: null, changeAmount: null };
  if (!tendered || BigInt(tendered) < BigInt(total)) throw new ConflictException('INSUFFICIENT_TENDER');
  return { tenderedAmount: BigInt(tendered), changeAmount: BigInt(tendered) - BigInt(total) };
}

export { calculatePaymentAmounts };

function modifierUnitPrice(basePrice: string, deltas: string[]): bigint {
  const total = deltas.reduce((sum, delta) => sum + BigInt(delta), BigInt(basePrice));
  if (total < 0n) throw new ConflictException('INVALID_MODIFIER_PRICE');
  return total;
}

export { modifierUnitPrice };
