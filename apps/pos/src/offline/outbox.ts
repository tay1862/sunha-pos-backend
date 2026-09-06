import * as SQLite from 'expo-sqlite';

export type OutboxStatus = 'PENDING' | 'SYNCING' | 'ACKED' | 'FAILED_REVIEW';
let database: SQLite.SQLiteDatabase | null = null;

async function db(): Promise<SQLite.SQLiteDatabase> {
  database ??= await SQLite.openDatabaseAsync('sunha-pos.db');
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS outbox (operation_id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, error TEXT)',
  );
  return database;
}

export async function enqueueOperation(
  operationId: string,
  type: string,
  payload: unknown,
): Promise<void> {
  const database = await db();
  await database.runAsync(
    'INSERT OR IGNORE INTO outbox (operation_id, type, payload, status, created_at) VALUES (?, ?, ?, ?, ?)',
    operationId,
    type,
    JSON.stringify(payload),
    'PENDING',
    new Date().toISOString(),
  );
}

export async function pendingOperations(
  limit = 50,
): Promise<Array<{ operationId: string; type: string; payload: unknown }>> {
  const database = await db();
  const rows = await database.getAllAsync<{ operation_id: string; type: string; payload: string }>(
    'SELECT operation_id, type, payload FROM outbox WHERE status = ? ORDER BY created_at LIMIT ?',
    'PENDING',
    limit,
  );
  return rows.map((row) => ({
    operationId: row.operation_id,
    type: row.type,
    payload: JSON.parse(row.payload) as unknown,
  }));
}

export async function markOperation(
  operationId: string,
  status: OutboxStatus,
  error?: string,
): Promise<void> {
  const database = await db();
  await database.runAsync(
    'UPDATE outbox SET status = ?, error = ? WHERE operation_id = ?',
    status,
    error ?? null,
    operationId,
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

export async function failedOperations(): Promise<
  Array<{ operationId: string; error: string | null }>
> {
  const database = await db();
  return database.getAllAsync<{ operationId: string; error: string | null }>(
    'SELECT operation_id as operationId, error FROM outbox WHERE status = ?',
    'FAILED_REVIEW',
  );
}
