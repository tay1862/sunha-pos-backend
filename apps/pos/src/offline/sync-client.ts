import { apiRequest } from '../api/client';
import { getAccessToken, getSessionContext } from '../auth/token-storage';
import { claimPendingOperations, enqueueOperation, markOperation } from './outbox';
import { getLocalDatabase } from './local-db';

let activeSync: Promise<void> | null = null;

export async function syncPending(deviceId: string, employeeId: string): Promise<void> {
  if (activeSync) return activeSync;
  activeSync = runSync(deviceId, employeeId).finally(() => {
    activeSync = null;
  });
  return activeSync;
}

async function runSync(deviceId: string, employeeId: string): Promise<void> {
  const operations = await claimPendingOperations();
  const token = await getAccessToken();
  let pushCompleted = false;
  try {
    if (operations.length) {
      const result = await apiRequest<{
        results: Array<{ operationId: string; status: 'ACKED' | 'FAILED_REVIEW'; error?: string }>;
      }>('/sync/push', {
        method: 'POST',
        accessToken: token ?? undefined,
        body: { deviceId, employeeId, operations },
      });
      await Promise.all(
        result.results.map((item) => markOperation(item.operationId, item.status, item.error)),
      );
      pushCompleted = true;
    }
    const db = await getLocalDatabase();
    const context = await getSessionContext();
    const cursorKey = `cursor:${context.tenantId}:${context.storeId}:${deviceId}`;
    const cursor = await db.getFirstAsync<{ value: string }>(
      'SELECT value FROM sync_meta WHERE key = ?',
      cursorKey,
    );
    const pulled = await apiRequest<{ cursor: string; operations: unknown[] }>(
      `/sync/pull${cursor?.value ? `?cursor=${encodeURIComponent(cursor.value)}` : ''}`,
      { accessToken: token ?? undefined },
    );
    if (pulled.cursor)
      await db.runAsync(
        'INSERT OR REPLACE INTO sync_meta (key, value) VALUES (?, ?)',
        cursorKey,
        pulled.cursor,
      );
  } catch (error) {
    if (!pushCompleted)
      await Promise.all(
        operations.map((operation) =>
          markOperation(
            operation.operationId,
            'PENDING',
            error instanceof Error ? error.message : 'SYNC_RETRY',
          ),
        ),
      );
  }
}

export { enqueueOperation };
