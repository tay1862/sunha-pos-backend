import { getLocalDatabase } from './local-db';
import { getSessionContext } from '../auth/token-storage';

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'ACKED' | 'FAILED_REVIEW';
export type OutboxOperation = {
  operationId: string;
  type: string;
  payload: unknown;
  occurredAtDevice: string;
  dependsOn?: string[];
};

export async function enqueueOperation(operation: OutboxOperation): Promise<void> {
  const database = await getLocalDatabase();
  const context = await getSessionContext();
  await database.runAsync(
    'INSERT OR IGNORE INTO outbox (operation_id, type, payload, occurred_at, status, created_at, attempt_count, depends_on, tenant_id, store_id, device_id) VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)',
    operation.operationId,
    operation.type,
    JSON.stringify(operation.payload),
    operation.occurredAtDevice,
    'PENDING',
    new Date().toISOString(),
    JSON.stringify(operation.dependsOn ?? []),
    context.tenantId ?? 'unknown', context.storeId ?? 'unknown', context.deviceId ?? 'unknown',
  );
}

export async function pendingOperations(limit = 50): Promise<OutboxOperation[]> {
  const database = await getLocalDatabase();
  const context = await getSessionContext();
  const rows = await database.getAllAsync<{
    operation_id: string;
    type: string;
    payload: string;
    occurred_at: string;
    depends_on: string | null;
  }>(
    "SELECT operation_id, type, payload, occurred_at, depends_on FROM outbox WHERE status = 'PENDING' AND tenant_id = ? AND store_id = ? AND device_id = ? AND (next_retry_epoch IS NULL OR next_retry_epoch <= ?) ORDER BY created_at LIMIT ?",
    context.tenantId ?? 'unknown', context.storeId ?? 'unknown', context.deviceId ?? 'unknown',
    Date.now(),
    limit,
  );
  return rows.map((row) => ({
    operationId: row.operation_id,
    type: row.type,
    payload: JSON.parse(row.payload) as unknown,
    occurredAtDevice: row.occurred_at,
    dependsOn: row.depends_on ? (JSON.parse(row.depends_on) as string[]) : [],
  }));
}

export async function claimPendingOperations(limit = 50, leaseMs = 60_000): Promise<OutboxOperation[]> {
  const database = await getLocalDatabase();
  const context = await getSessionContext();
  const now = Date.now();
  const rows = await database.getAllAsync<{ operation_id: string; type: string; payload: string; occurred_at: string; depends_on: string | null }>(
    "SELECT operation_id, type, payload, occurred_at, depends_on FROM outbox WHERE status = 'PENDING' AND tenant_id = ? AND store_id = ? AND device_id = ? AND (next_retry_epoch IS NULL OR next_retry_epoch <= ?) ORDER BY created_at LIMIT ?",
    context.tenantId ?? 'unknown', context.storeId ?? 'unknown', context.deviceId ?? 'unknown', now, limit,
  );
  if (!rows.length) return [];
  await database.withTransactionAsync(async () => {
    for (const row of rows)
      await database.runAsync("UPDATE outbox SET status='SYNCING', syncing_until=?, attempt_count=attempt_count+1 WHERE operation_id=? AND status='PENDING'", now + leaseMs, row.operation_id);
  });
  return rows.map((row) => ({ operationId: row.operation_id, type: row.type, payload: JSON.parse(row.payload) as unknown, occurredAtDevice: row.occurred_at, dependsOn: row.depends_on ? (JSON.parse(row.depends_on) as string[]) : [] }));
}

export async function markOperation(
  operationId: string,
  status: OutboxStatus,
  error?: string,
): Promise<void> {
  const database = await getLocalDatabase();
  if (status === 'PENDING') {
    await database.runAsync(
      'UPDATE outbox SET status = ?, next_retry_epoch = ?, syncing_until = NULL, error = ? WHERE operation_id = ?',
      status,
      Date.now() + retryDelayMs(1),
      error ?? null,
      operationId,
    );
  } else
    await database.runAsync(
      'UPDATE outbox SET status = ?, error = ?, next_retry_epoch = NULL, syncing_until = NULL WHERE operation_id = ?',
      status,
      error ?? null,
      operationId,
    );
}

export async function listOperations(status?: OutboxStatus) {
  const database = await getLocalDatabase();
  return database.getAllAsync<{
    operation_id: string;
    type: string;
      status: OutboxStatus;
    attempt_count: number;
    error: string | null;
    created_at: string;
  }>(
    status
      ? 'SELECT operation_id, type, status, attempt_count, error, created_at FROM outbox WHERE status = ? ORDER BY created_at DESC'
      : 'SELECT operation_id, type, status, attempt_count, error, created_at FROM outbox ORDER BY created_at DESC',
    ...(status ? [status] : []),
  );
}

export function canChargeOffline(
  sellingDeviceCount: number,
  leaseExpiresAt: string | null,
  now = new Date(),
): boolean {
  return (
    sellingDeviceCount === 1 &&
    !!leaseExpiresAt &&
    new Date(leaseExpiresAt).getTime() > now.getTime()
  );
}
export function retryDelayMs(attempt: number): number {
  const base = Math.min(60 * 60 * 1000, 1000 * 2 ** Math.max(0, attempt - 1));
  return Math.round(base * (0.75 + Math.random() * 0.5));
}
