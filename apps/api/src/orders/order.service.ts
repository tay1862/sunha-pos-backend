import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { CheckoutOrderInput } from '@sunha/contracts';
import { calculateOrderTotals, toBaseQuantity } from '@sunha/domain';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}
  async checkout(tenantId: string, employeeId: string, input: CheckoutOrderInput) {
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
      include: { item: true },
    });
    const byId = new Map(units.map((unit) => [unit.id, unit]));
    const resolved = input.lines.map((line) => {
      const unit = byId.get(line.unitId);
      if (!unit || unit.itemId !== line.itemId) throw new ConflictException('INVALID_ORDER_LINE');
      return { line, unit };
    });
    const totals = calculateTotals({
      lines: resolved.map(({ line, unit }) => ({
        unitPrice: unit.priceAmount.toString(),
        quantity: line.quantity,
      })),
      discount: input.discount,
      taxRateBasisPoints: effectiveTaxRate,
      taxMode: effectiveTaxMode,
    });
    if (
      input.paymentType === 'CASH' &&
      (!input.tenderedAmount || BigInt(input.tenderedAmount.amount) < BigInt(totals.total))
    )
      throw new ConflictException('INSUFFICIENT_TENDER');
    const receiptNumber = `SUNHA-${input.clientOrderId}`;
    return this.prisma.$transaction(async (tx) => {
      for (const { line, unit } of resolved) {
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
          status: 'COMPLETED',
          subtotalAmount: BigInt(totals.subtotal),
          discountAmount: BigInt(totals.discount),
          taxAmount: BigInt(totals.tax),
          totalAmount: BigInt(totals.total),
          currency: 'LAK',
          offline: input.offline,
          completedAt: new Date(),
          lines: {
            create: resolved.map(({ line, unit }) => ({
              itemId: line.itemId,
              unitId: unit.id,
              itemNameSnapshot: unit.item.name,
              unitNameSnapshot: unit.name,
              quantity: line.quantity,
              multiplierSnapshot: unit.multiplierToBase,
              unitPriceAmount: unit.priceAmount,
              lineTotalAmount: BigInt(
                calculateTotals({
                  lines: [{ unitPrice: unit.priceAmount.toString(), quantity: line.quantity }],
                  taxRateBasisPoints: 0,
                }).subtotal,
              ),
              note: line.note,
            })),
          },
          payments: {
            create: {
              type: input.paymentType,
              amount: BigInt(totals.total),
              tenderedAmount: input.tenderedAmount ? BigInt(input.tenderedAmount.amount) : null,
              changeAmount: input.tenderedAmount
                ? BigInt(input.tenderedAmount.amount) - BigInt(totals.total)
                : null,
              reference: input.paymentReference,
              unverified: input.paymentType === 'MANUAL_QR',
            },
          },
          receipts: { create: { number: receiptNumber } },
        },
        include: { receipts: true, payments: true },
      });
    });
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
