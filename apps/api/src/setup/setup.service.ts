import { Injectable, NotFoundException } from '@nestjs/common';
import type { StoreSettings, UpdateStoreSettingsInput } from '@sunha/contracts';
import { PrismaService } from '../database/prisma.service.js';

@Injectable()
export class SetupService {
  constructor(private readonly prisma: PrismaService) {}

  async getStore(tenantId: string): Promise<StoreSettings & { id: string; tenantId: string }> {
    const store = await this.prisma.store.findUnique({ where: { tenantId } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    return this.toSettings(store);
  }

  async updateStore(tenantId: string, input: UpdateStoreSettingsInput) {
    const store = await this.prisma.store.findUnique({ where: { tenantId } });
    if (!store) throw new NotFoundException('STORE_NOT_FOUND');
    return this.toSettings(await this.prisma.store.update({ where: { tenantId }, data: input }));
  }

  private toSettings(store: {
    id: string;
    tenantId: string;
    name: string;
    address: string;
    phone: string;
    taxNumber: string;
    currency: string;
    timezone: string;
    language: string;
  }): StoreSettings & { id: string; tenantId: string } {
    return {
      id: store.id,
      tenantId: store.tenantId,
      name: store.name,
      address: store.address,
      phone: store.phone,
      taxNumber: store.taxNumber,
      currency: 'LAK',
      timezone: store.timezone,
      language: store.language === 'en' ? 'en' : 'lo',
    };
  }
}
