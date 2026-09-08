import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { RefundService } from '../refunds/refund.service.js';
import { ShiftService } from '../shifts/shift.service.js';
import argon2 from 'argon2';
import { OrderService } from './order.service.js';
import { SyncService } from '../sync/sync.service.js';

const runIntegration = process.env.RUN_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);

describe.skipIf(!runIntegration)('PostgreSQL concurrent checkout', () => {
  const prisma = new PrismaService();
  const orders = new OrderService(prisma);
  const refunds = new RefundService(prisma);
  const shifts = new ShiftService(prisma);
  const sync = new SyncService(prisma, orders, shifts);
  let tenantId: string;
  let storeId: string;
  let employeeId: string;
  let itemId: string;
  let unitId: string;
  let managerId: string;
  let deviceId: string;

  beforeAll(async () => {
    const tenant = await prisma.tenant.create({
      data: { businessName: `integration-${randomUUID()}`, country: 'LA' },
    });
    tenantId = tenant.id;
    const store = await prisma.store.create({ data: { tenantId, name: 'Integration store' } });
    storeId = store.id;
    const employee = await prisma.employee.create({
      data: { tenantId, storeId, name: 'Integration owner', role: 'OWNER', pinHash: 'unused' },
    });
    employeeId = employee.id;
    const manager = await prisma.employee.create({
      data: {
        tenantId,
        storeId,
        name: 'Integration manager',
        role: 'MANAGER',
        pinHash: await argon2.hash('123456'),
      },
    });
    managerId = manager.id;
    const device = await prisma.device.create({
      data: {
        tenantId,
        storeId,
        name: 'Integration device',
        status: 'ACTIVE',
        offlineLeaseExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    deviceId = device.id;
    const item = await prisma.item.create({
      data: {
        storeId,
        name: 'Concurrent item',
        trackStock: true,
        units: { create: { name: 'each', multiplierToBase: '1', priceAmount: 1000 } },
        inventory: { create: { quantityBase: 1 } },
      },
      include: { units: true },
    });
    itemId = item.id;
    const unit = item.units[0];
    if (!unit) throw new Error('integration unit was not created');
    unitId = unit.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.syncOperation.deleteMany({ where: { tenantId } });
      await prisma.refund.deleteMany({ where: { order: { tenantId } } });
      await prisma.shift.deleteMany({ where: { storeId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    await prisma.$disconnect();
  });

  it('never oversells stock and makes a retry idempotent', async () => {
    const clientOrderId = randomUUID();
    const input = {
      clientOrderId,
      lines: [{ itemId, unitId, quantity: '1', modifierOptionIds: [], note: '' }],
      paymentType: 'CASH' as const,
      tenderedAmount: { amount: '1000', currency: 'LAK' as const },
      taxRateBasisPoints: 0,
      offline: false,
    };
    const results = await Promise.allSettled([
      orders.checkout(tenantId, employeeId, input, deviceId),
      orders.checkout(tenantId, employeeId, input, deviceId),
    ]);
    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');
    expect(fulfilled.length).toBeGreaterThanOrEqual(1);
    expect(rejected.length).toBeLessThanOrEqual(1);
    if (rejected[0]) expect(String(rejected[0].reason)).toContain('INSUFFICIENT_STOCK');
    expect(await prisma.order.count({ where: { tenantId, clientOrderId } })).toBe(1);
    expect(
      (
        await prisma.inventoryLevel.findUniqueOrThrow({ where: { itemId } })
      ).quantityBase.toString(),
    ).toBe('0');
    const first = fulfilled[0];
    if (!first || first.status !== 'fulfilled') throw new Error('checkout did not succeed');
    const retry = await orders.checkout(tenantId, employeeId, input, deviceId);
    expect(retry.id).toBe(first.value.id);
  });

  it('reconciles checkout, immutable receipt and full refund ledgers', async () => {
    await prisma.inventoryLevel.update({ where: { itemId }, data: { quantityBase: 1 } });
    const clientOrderId = randomUUID();
    const input = {
      clientOrderId,
      lines: [{ itemId, unitId, quantity: '1', modifierOptionIds: [], note: '' }],
      paymentType: 'MANUAL_QR' as const,
      paymentReference: 'QR-TEST-1',
      taxRateBasisPoints: 0,
      offline: false,
    };
    const order = await orders.checkout(tenantId, employeeId, input, deviceId);
    expect(order.receipts).toHaveLength(1);
    expect(order.payments[0]?.unverified).toBe(true);
    const receiptNumber = order.receipts[0]?.number;
    const refund = await refunds.refund(tenantId, employeeId, deviceId, {
      orderId: order.id,
      managerEmployeeId: managerId,
      managerPin: '123456',
      reason: 'integration test',
    });
    expect(refund.amount.toString()).toBe('1000');
    const refundedOrder = await prisma.order.findUniqueOrThrow({
      where: { id: order.id },
      include: { receipts: true },
    });
    expect(refundedOrder.status).toBe('REFUNDED');
    expect(refundedOrder.receipts[0]?.number).toBe(receiptNumber);
    expect(await prisma.receipt.count({ where: { orderId: order.id } })).toBe(1);
    expect(
      (await prisma.payment.findMany({ where: { orderId: order.id } })).reduce(
        (sum, payment) => sum + payment.amount,
        0n,
      ),
    ).toBe(0n);
    expect(
      (
        await prisma.inventoryLevel.findUniqueOrThrow({ where: { itemId } })
      ).quantityBase.toString(),
    ).toBe('1');
    await expect(
      refunds.refund(tenantId, employeeId, deviceId, {
        orderId: order.id,
        managerEmployeeId: managerId,
        managerPin: '123456',
        reason: 'duplicate',
      }),
    ).rejects.toThrow('ORDER_NOT_REFUNDABLE');
  });

  it('opens one shared shift, records cash movement and closes with blind expected cash', async () => {
    const opened = await shifts.open(tenantId, employeeId, deviceId, { openingAmount: '500' });
    expect(opened.isOpen).toBe(true);
    await shifts.movement(tenantId, employeeId, deviceId, {
      amount: '100',
      type: 'CASH_IN',
      reason: 'float',
    });
    await expect(
      shifts.open(tenantId, employeeId, deviceId, { openingAmount: '1' }),
    ).rejects.toThrow('SHIFT_ALREADY_OPEN');
    const closed = await shifts.close(tenantId, employeeId, deviceId, { closingAmount: '600' });
    expect(closed.expectedAmount).toBe('600');
    expect(closed.variance).toBe('0');
    await expect(
      shifts.close(tenantId, employeeId, deviceId, { closingAmount: '600' }),
    ).rejects.toThrow('NO_OPEN_SHIFT');
  });

  it('replays offline checkout once and routes expired or multi-device operations to review', async () => {
    const operationId = randomUUID();
    const input = {
      clientOrderId: randomUUID(),
      lines: [{ itemId, unitId, quantity: '1', modifierOptionIds: [], note: '' }],
      paymentType: 'CASH' as const,
      tenderedAmount: { amount: '1000', currency: 'LAK' as const },
      taxRateBasisPoints: 0,
      offline: true,
    };
    const first = await sync.push(tenantId, {
      deviceId,
      employeeId,
      operations: [
        {
          operationId,
          type: 'CHECKOUT_ORDER',
          occurredAtDevice: new Date().toISOString(),
          payload: input,
        },
      ],
    });
    expect(first.results[0]?.status).toBe('ACKED');
    const duplicate = await sync.push(tenantId, {
      deviceId,
      employeeId,
      operations: [
        {
          operationId,
          type: 'CHECKOUT_ORDER',
          occurredAtDevice: new Date().toISOString(),
          payload: input,
        },
      ],
    });
    expect(duplicate.results[0]?.status).toBe('ACKED');
    expect(await prisma.order.count({ where: { clientOrderId: input.clientOrderId } })).toBe(1);

    await prisma.device.update({
      where: { id: deviceId },
      data: { offlineLeaseExpiresAt: new Date(Date.now() - 1) },
    });
    const expired = await sync.push(tenantId, {
      deviceId,
      employeeId,
      operations: [
        {
          operationId: randomUUID(),
          type: 'CHECKOUT_ORDER',
          occurredAtDevice: new Date().toISOString(),
          payload: { ...input, clientOrderId: randomUUID() },
        },
      ],
    });
    expect(expired.results[0]).toMatchObject({
      status: 'FAILED_REVIEW',
      error: 'OFFLINE_LEASE_EXPIRED',
    });
    await prisma.device.create({
      data: {
        tenantId,
        storeId,
        name: 'Second device',
        status: 'ACTIVE',
        offlineLeaseExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    await prisma.device.update({
      where: { id: deviceId },
      data: { offlineLeaseExpiresAt: new Date(Date.now() + 86_400_000) },
    });
    const multi = await sync.push(tenantId, {
      deviceId,
      employeeId,
      operations: [
        {
          operationId: randomUUID(),
          type: 'CHECKOUT_ORDER',
          occurredAtDevice: new Date().toISOString(),
          payload: { ...input, clientOrderId: randomUUID() },
        },
      ],
    });
    expect(multi.results[0]).toMatchObject({
      status: 'FAILED_REVIEW',
      error: 'MULTI_DEVICE_OFFLINE_FORBIDDEN',
    });
  });
});
