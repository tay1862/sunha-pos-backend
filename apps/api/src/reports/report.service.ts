import { Injectable } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ReportService {
  constructor(private readonly prisma: PrismaService) {}
  async sales(tenantId: string, from?: string, to?: string) {
    const orders = await this.prisma.order.findMany({
      where: {
        tenantId,
        status: { in: ['COMPLETED', 'REFUNDED'] },
        createdAt: {
          gte: from ? new Date(from) : new Date(0),
          lte: to ? new Date(to) : new Date(),
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
    const total = orders.reduce((sum, order) => sum + order.totalAmount, 0n);
    return {
      from,
      to,
      orderCount: orders.length,
      totalAmount: total.toString(),
      byEmployee: groupAmount(orders, 'employeeId'),
      byDevice: groupAmount(orders, 'deviceId'),
    };
  }
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
