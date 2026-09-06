import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { OrderService } from './order.service.js';

const runIntegration = process.env.RUN_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runIntegration)('PostgreSQL concurrent checkout', () => {
  const prisma = new PrismaService();
  const orders = new OrderService(prisma);
  let tenantId: string;
  let storeId: string;
  let employeeId: string;
  let itemId: string;
  let unitId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({ data: { businessName: `integration-${randomUUID()}`, country: 'LA' } });
    tenantId = tenant.id;
    const store = await prisma.store.create({ data: { tenantId, name: 'Integration store' } });
    storeId = store.id;
    const employee = await prisma.employee.create({ data: { tenantId, storeId, name: 'Integration owner', role: 'OWNER', pinHash: 'unused' } });
    employeeId = employee.id;
    const item = await prisma.item.create({ data: { storeId, name: 'Concurrent item', trackStock: true, units: { create: { name: 'each', multiplierToBase: '1', priceAmount: 1000 } }, inventory: { create: { quantityBase: 1 } } }, include: { units: true } });
    itemId = item.id;
    const unit = item.units[0];
    if (!unit) throw new Error('integration unit was not created');
    unitId = unit.id;
  });

  afterAll(async () => {
    if (tenantId) await prisma.tenant.delete({ where: { id: tenantId } });
    await prisma.$disconnect();
  });

  it('returns one idempotent order and never oversells stock', async () => {
    const clientOrderId = randomUUID();
    const input = { clientOrderId, lines: [{ itemId, unitId, quantity: '1', modifierOptionIds: [], note: '' }], paymentType: 'CASH' as const, tenderedAmount: { amount: '1000', currency: 'LAK' as const }, taxRateBasisPoints: 0, offline: false };
    const result = await Promise.all([orders.checkout(tenantId, employeeId, input, undefined), orders.checkout(tenantId, employeeId, input, undefined)]);
    expect(result[0].id).toBe(result[1].id);
    expect(await prisma.order.count({ where: { tenantId, clientOrderId } })).toBe(1);
    expect((await prisma.inventoryLevel.findUniqueOrThrow({ where: { itemId } })).quantityBase.toString()).toBe('0');
  });
});
