import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class ReceiptService {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, search?: string) {
    const receipts = await this.prisma.receipt.findMany({
      where: {
        order: { tenantId },
        ...(search ? { number: { contains: search, mode: 'insensitive' } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        order: {
          include: {
            lines: { include: { modifiers: true } },
            payments: true,
            refunds: true,
            employee: { select: { name: true } },
          },
        },
      },
    });
    return receipts;
  }

  async get(tenantId: string, id: string) {
    const receipt = await this.prisma.receipt.findFirst({
      where: { id, order: { tenantId } },
      include: {
        order: {
          include: {
            lines: { include: { modifiers: true } },
            payments: true,
            refunds: true,
            employee: { select: { name: true } },
          },
        },
      },
    });
    if (!receipt) throw new NotFoundException('RECEIPT_NOT_FOUND');
    return receipt;
  }
}
