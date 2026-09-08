import { getLocalDatabase } from './local-db';

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
  await database.runAsync(
    'INSERT OR IGNORE INTO outbox (operation_id, type, payload, occurred_at, status, created_at, attempt_count, depends_on) VALUES (?, ?, ?, ?, ?, ?, 0, ?)',
    operation.operationId,
    operation.type,
    JSON.stringify(operation.payload),
    operation.occurredAtDevice,
    'PENDING',
    new Date().toISOString(),
    JSON.stringify(operation.dependsOn ?? []),
  );
}

export async function pendingOperations(limit = 50): Promise<OutboxOperation[]> {
  const database = await getLocalDatabase();
  const rows = await database.getAllAsync<{
    operation_id: string;
    type: string;
    payload: string;
    occurred_at: string;
    depends_on: string | null;
  }>(
    "SELECT operation_id, type, payload, occurred_at, depends_on FROM outbox WHERE status = 'PENDING' AND (next_retry_at IS NULL OR next_retry_at <= datetime('now')) ORDER BY created_at LIMIT ?",
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

export async function markOperation(
  operationId: string,
  status: OutboxStatus,
  error?: string,
): Promise<void> {
  const database = await getLocalDatabase();
  if (status === 'PENDING') {
    await database.runAsync(
      'UPDATE outbox SET status = ?, attempt_count = attempt_count + 1, next_retry_at = ?, error = ? WHERE operation_id = ?',
      status,
      new Date(Date.now() + retryDelayMs(1)).toISOString(),
      error ?? null,
      operationId,
    );
  } else
    await database.runAsync(
      'UPDATE outbox SET status = ?, error = ?, next_retry_at = NULL WHERE operation_id = ?',
      status,
      error ?? null,
      operationId,
    );
}

export async function markSyncing(operationIds: string[]) {
  const database = await getLocalDatabase();
  for (const id of operationIds)
    await database.runAsync(
      "UPDATE outbox SET status = 'SYNCING', attempt_count = attempt_count + 1 WHERE operation_id = ?",
      id,
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
  return Math.min(60 * 60 * 1000, 1000 * 2 ** Math.max(0, attempt - 1));
}
