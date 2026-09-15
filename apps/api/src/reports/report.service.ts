import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}
  private range(from?: string, to?: string) {
    const start = from ? new Date(from) : new Date(0);
    const end = to ? new Date(to) : new Date();
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start >= end)
      throw new BadRequestException('INVALID_REPORT_RANGE');
    return { gte: start, lt: end };
  }
  async sales(tenantId: string, from?: string, to?: string) {
    const dateRange = this.range(from, to);
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'REFUNDED'] },
        createdAt: {
          ...dateRange,
        },
      },
      select: {
        id: true,
        totalAmount: true,
        discountAmount: true,
        taxAmount: true,
        employeeId: true,
        deviceId: true,
        createdAt: true,
      },
    });
    const refunds = await this.prisma.refund.findMany({
      where: { order: { tenantId }, createdAt: dateRange },
      select: { amount: true, orderId: true },
    });
    const total = calculateNetSales(orders, refunds);
    return {
      from,
      to,
      orderCount: orders.length,
      totalAmount: total.toString(),
      byEmployee: groupAmount(orders, 'employeeId'),
      byDevice: groupAmount(orders, 'deviceId'),
      refundAmount: refunds.reduce((sum, refund) => sum + refund.amount, 0n).toString(),
    };
  }

  async payments(tenantId: string, from?: string, to?: string) {
    const rows = await this.prisma.payment.findMany({
      where: { order: { tenantId }, createdAt: this.range(from, to) },
      select: { type: true, amount: true, unverified: true },
    });
    const grouped = new Map<string, { amount: bigint; count: number; unverified: number }>();
    for (const row of rows) {
      const current = grouped.get(row.type) ?? { amount: 0n, count: 0, unverified: 0 };
      current.amount += row.amount;
      current.count += 1;
      current.unverified += row.unverified ? 1 : 0;
      grouped.set(row.type, current);
    }
    return [...grouped].map(([type, value]) => ({
      type,
      amount: value.amount.toString(),
      count: value.count,
      unverified: value.unverified,
    }));
  }

  async discounts(tenantId: string, from?: string, to?: string) {
    const rows = await this.prisma.order.findMany({
      where: { tenantId, createdAt: this.range(from, to), discountAmount: { gt: 0 } },
      select: { id: true, discountAmount: true, employeeId: true, deviceId: true, createdAt: true },
    });
    return {
      count: rows.length,
      amount: rows.reduce((sum, row) => sum + row.discountAmount, 0n).toString(),
      rows,
    };
  }

  async refunds(tenantId: string, from?: string, to?: string) {
    return this.prisma.refund.findMany({
      where: { order: { tenantId }, createdAt: this.range(from, to) },
      include: {
        order: { select: { id: true, totalAmount: true, employeeId: true, deviceId: true } },
        manager: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async shifts(tenantId: string, from?: string, to?: string) {
    return this.prisma.shift.findMany({
      where: { store: { tenantId }, openedAt: this.range(from, to) },
      include: { employee: { select: { id: true, name: true } }, cashMovements: true },
      orderBy: { openedAt: 'desc' },
    });
  }

  async stock(tenantId: string) {
    return this.prisma.inventoryLevel.findMany({
      where: { item: { store: { tenantId } } },
      include: { item: { select: { id: true, name: true, trackStock: true } } },
    });
  }

  async audit(tenantId: string, from?: string, to?: string) {
    return this.prisma.auditEvent.findMany({
      where: { tenantId, occurredAt: this.range(from, to) },
      orderBy: { occurredAt: 'desc' },
      take: 500,
    });
  }

  async csv(tenantId: string, kind: string, from?: string, to?: string) {
    const rawRows =
      kind === 'payments'
        ? await this.payments(tenantId, from, to)
        : kind === 'refunds'
          ? await this.refunds(tenantId, from, to)
          : await this.sales(tenantId, from, to).then((value) => [value]);
    const rows = rawRows.map((row) => {
      const value = row as Record<string, unknown>;
      if (kind === 'refunds') {
        const order = value.order as Record<string, unknown> | undefined;
        const manager = value.manager as Record<string, unknown> | undefined;
        return { id: value.id, orderId: value.orderId, amount: value.amount, reason: value.reason, createdAt: value.createdAt, orderTotal: order?.totalAmount, cashierId: order?.employeeId, managerId: manager?.id, managerName: manager?.name };
      }
      return value;
    });
    const first = rows[0];
    if (!first) return '';
    const columns = Object.keys(first);
    const escape = (value: unknown) => {
      const text =
        value === null || value === undefined
          ? ''
          : typeof value === 'object'
            ? (JSON.stringify(value) ?? '')
            : typeof value === 'string'
              ? value
              : typeof value === 'number'
                ? value.toString()
                : typeof value === 'boolean'
                  ? value
                    ? 'true'
                    : 'false'
                  : (JSON.stringify(value) ?? '');
      return `"${text.replaceAll('"', '""')}"`;
    };
    return ['\ufeff' + columns.join(','),
      ...rows.map((row) =>
        columns.map((column) => escape(row[column])).join(','),
      ),
    ].join('\n');
  }
}

export function calculateNetSales(
  orders: Array<{ totalAmount: bigint }>,
  refunds: Array<{ amount: bigint }>,
): bigint {
  return (
    orders.reduce((sum, order) => sum + order.totalAmount, 0n) -
    refunds.reduce((sum, refund) => sum + refund.amount, 0n)
  );
}

function groupAmount(
  rows: Array<{ totalAmount: bigint; employeeId: string; deviceId: string | null }>,
  key: 'employeeId' | 'deviceId',
) {
  const values = new Map<string, bigint>();
  for (const row of rows) {
    const id = row[key] ?? 'unassigned';
    values.set(id, (values.get(id) ?? 0n) + row.totalAmount);
  }
  return [...values].map(([id, amount]) => ({ id, amount: amount.toString() }));
}
