import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { PrismaService } from '../database/prisma.service.js';
import { RefundService } from '../refunds/refund.service.js';
import { ShiftService } from '../shifts/shift.service.js';
import argon2 from 'argon2';
import { OrderService } from './order.service.js';
import { SyncService } from '../sync/sync.service.js';

const runIntegration = process.env.RUN_INTEGRATION === 'true' && Boolean(process.env.DATABASE_URL);
if (process.env.RUN_INTEGRATION === 'true' && !process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL_REQUIRED_FOR_INTEGRATION');
}

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
  let foreignTenantId: string;
  let foreignStoreId: string;
  let foreignEmployeeId: string;
  let foreignDeviceId: string;

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

    const foreignTenant = await prisma.tenant.create({
      data: { businessName: `foreign-${randomUUID()}`, country: 'LA' },
    });
    foreignTenantId = foreignTenant.id;
    const foreignStore = await prisma.store.create({
      data: { tenantId: foreignTenantId, name: 'Foreign store' },
    });
    foreignStoreId = foreignStore.id;
    const foreignEmployee = await prisma.employee.create({
      data: {
        tenantId: foreignTenantId,
        storeId: foreignStoreId,
        name: 'Foreign owner',
        role: 'OWNER',
        pinHash: 'unused',
      },
    });
    foreignEmployeeId = foreignEmployee.id;
    const foreignDevice = await prisma.device.create({
      data: {
        tenantId: foreignTenantId,
        storeId: foreignStoreId,
        name: 'Foreign device',
        status: 'ACTIVE',
        offlineLeaseExpiresAt: new Date(Date.now() + 86_400_000),
      },
    });
    foreignDeviceId = foreignDevice.id;
  });

  afterAll(async () => {
    if (tenantId) {
      await prisma.syncOperation.deleteMany({ where: { tenantId } });
      await prisma.refund.deleteMany({ where: { order: { tenantId } } });
      await prisma.shift.deleteMany({ where: { storeId } });
      await prisma.tenant.delete({ where: { id: tenantId } });
    }
    if (foreignTenantId) {
      await prisma.syncOperation.deleteMany({ where: { tenantId: foreignTenantId } });
      await prisma.refund.deleteMany({ where: { order: { tenantId: foreignTenantId } } });
      await prisma.shift.deleteMany({ where: { storeId: foreignStoreId } });
      await prisma.tenant.delete({ where: { id: foreignTenantId } });
    }
    await prisma.$disconnect();
  });

  it('keeps catalog, checkout and device operations isolated between tenants', async () => {
    const input = {
      clientOrderId: randomUUID(),
      lines: [{ itemId, unitId, quantity: '1', modifierOptionIds: [], note: '' }],
      paymentType: 'CASH' as const,
      tenderedAmount: { amount: '1000', currency: 'LAK' as const },
      taxRateBasisPoints: 0,
      offline: false,
    };
    await expect(
      orders.checkout(foreignTenantId, foreignEmployeeId, input, foreignDeviceId),
    ).rejects.toThrow('INVALID_ORDER_LINE');
    await expect(
      sync.push(foreignTenantId, {
        deviceId,
        employeeId,
        operations: [],
      }),
    ).rejects.toThrow('DEVICE_OR_EMPLOYEE_NOT_ALLOWED');
    expect(await prisma.order.count({ where: { tenantId: foreignTenantId } })).toBe(0);
  });

  it('never oversells stock and makes a retry idempotent', async () => {
    await shifts.open(tenantId, employeeId, deviceId, { openingAmount: '0' });
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
    await shifts.close(tenantId, employeeId, deviceId, { closingAmount: '1000' });
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

  it('binds checkout payments to the active shift and blocks close with pending sync work', async () => {
    await prisma.inventoryLevel.update({ where: { itemId }, data: { quantityBase: 1 } });
    const opened = await shifts.open(tenantId, employeeId, deviceId, { openingAmount: '0' });
    const input = {
      clientOrderId: randomUUID(),
      lines: [{ itemId, unitId, quantity: '1', modifierOptionIds: [], note: '' }],
      paymentType: 'CASH' as const,
      tenderedAmount: { amount: '1000', currency: 'LAK' as const },
      taxRateBasisPoints: 0,
      offline: false,
    };
    const order = await orders.checkout(tenantId, employeeId, input, deviceId);
    expect(order.shiftId).toBe(opened.id);
    expect(order.payments[0]?.shiftId).toBe(opened.id);
    const pending = await prisma.syncOperation.create({
      data: {
        operationId: randomUUID(),
        tenantId,
        deviceId,
        employeeId,
        type: 'CHECKOUT_ORDER',
        payload: input,
        occurredAtDevice: new Date(),
      },
    });
    await expect(
      shifts.close(tenantId, employeeId, deviceId, { closingAmount: '1000' }),
    ).rejects.toThrow('PENDING_OPERATIONS');
    await prisma.syncOperation.delete({ where: { id: pending.id } });
    const closed = await shifts.close(tenantId, employeeId, deviceId, { closingAmount: '1000' });
    expect(closed.expectedAmount).toBe('1000');
    expect(await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).toMatchObject({
      shiftId: opened.id,
    });
  });

  it('preserves repeated closed shifts and serializes concurrent opening', async () => {
    for (let cycle = 0; cycle < 10; cycle++) {
      const attempts = await Promise.allSettled([
        shifts.open(foreignTenantId, foreignEmployeeId, foreignDeviceId, { openingAmount: '500' }),
        shifts.open(foreignTenantId, foreignEmployeeId, foreignDeviceId, { openingAmount: '500' }),
      ]);
      expect(attempts.filter((attempt) => attempt.status === 'fulfilled')).toHaveLength(1);
      await expect(
        shifts.movement(foreignTenantId, foreignEmployeeId, foreignDeviceId, {
          amount: '100',
          type: 'CASH_OUT',
          reason: 'invalid direction',
        }),
      ).rejects.toThrow('INVALID_CASH_MOVEMENT_AMOUNT');
      await shifts.movement(foreignTenantId, foreignEmployeeId, foreignDeviceId, {
        amount: '-100',
        type: 'CASH_OUT',
        reason: 'expense',
      });
      const closed = await shifts.close(foreignTenantId, foreignEmployeeId, foreignDeviceId, {
        closingAmount: '400',
      });
      expect(closed.expectedAmount).toBe('400');
      expect(closed.variance).toBe('0');
    }
    expect(await prisma.shift.count({ where: { storeId: foreignStoreId, isOpen: false } })).toBe(
      10,
    );
    await expect(
      shifts.open(foreignTenantId, foreignEmployeeId, randomUUID(), { openingAmount: '500' }),
    ).rejects.toThrow();
    expect(await prisma.shift.count({ where: { storeId: foreignStoreId, isOpen: true } })).toBe(0);
    expect(await prisma.shift.count({ where: { storeId: foreignStoreId } })).toBe(10);
  });

  it('rejects disabled items and units without changing stock or creating orders', async () => {
    const input = {
      clientOrderId: randomUUID(),
      lines: [{ itemId, unitId, quantity: '1', modifierOptionIds: [], note: '' }],
      paymentType: 'CASH' as const,
      tenderedAmount: { amount: '1000', currency: 'LAK' as const },
      taxRateBasisPoints: 0,
      offline: false,
    };
    const before = await prisma.inventoryLevel.findUniqueOrThrow({ where: { itemId } });
    try {
      await prisma.item.update({ where: { id: itemId }, data: { active: false } });
      await expect(orders.checkout(tenantId, employeeId, input, deviceId)).rejects.toThrow(
        'INVALID_ORDER_LINE',
      );
      await prisma.item.update({ where: { id: itemId }, data: { active: true } });
      await prisma.itemUnit.update({ where: { id: unitId }, data: { active: false } });
      await expect(orders.checkout(tenantId, employeeId, input, deviceId)).rejects.toThrow(
        'INVALID_ORDER_LINE',
      );
      expect(await prisma.order.count({ where: { clientOrderId: input.clientOrderId } })).toBe(0);
      expect(
        (
          await prisma.inventoryLevel.findUniqueOrThrow({ where: { itemId } })
        ).quantityBase.toString(),
      ).toBe(before.quantityBase.toString());
    } finally {
      await prisma.item.update({ where: { id: itemId }, data: { active: true } });
      await prisma.itemUnit.update({ where: { id: unitId }, data: { active: true } });
    }
  });

  it('replays offline checkout once and routes expired or multi-device operations to review', async () => {
    await prisma.inventoryLevel.update({ where: { itemId }, data: { quantityBase: 1 } });
    await shifts.open(tenantId, employeeId, deviceId, { openingAmount: '0' });
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
    await expect(sync.push(foreignTenantId, {
      deviceId: foreignDeviceId, employeeId: foreignEmployeeId,
      operations: [{ operationId, type: 'CHECKOUT_ORDER', occurredAtDevice: new Date().toISOString(), payload: input }],
    })).rejects.toThrow('OPERATION_ID_CONFLICT');
    const foreignOperationId = randomUUID();
    await prisma.syncOperation.create({ data: {
      operationId: foreignOperationId, tenantId: foreignTenantId, deviceId: foreignDeviceId,
      employeeId: foreignEmployeeId, type: 'CHECKOUT_ORDER', payload: { clientOrderId: input.clientOrderId },
      occurredAtDevice: new Date(), status: 'FAILED_REVIEW',
    } });
    expect((await sync.reconcile(foreignTenantId, foreignOperationId)).order).toBeNull();

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
  }, 30_000);
});
