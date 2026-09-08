import { apiRequest } from '../api/client';
import { getAccessToken } from '../auth/token-storage';
import { enqueueOperation, markOperation, markSyncing, pendingOperations } from './outbox';
import { getLocalDatabase } from './local-db';

export async function syncPending(deviceId: string, employeeId: string): Promise<void> {
  const operations = await pendingOperations();
  const token = await getAccessToken();
  try {
    if (operations.length) {
      await markSyncing(operations.map((operation) => operation.operationId));
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
    }
    const db = await getLocalDatabase();
    const cursor = await db.getFirstAsync<{ value: string }>(
      "SELECT value FROM sync_meta WHERE key = 'cursor'",
    );
    const pulled = await apiRequest<{ cursor: string; operations: unknown[] }>(
      `/sync/pull${cursor?.value ? `?cursor=${encodeURIComponent(cursor.value)}` : ''}`,
      { accessToken: token ?? undefined },
    );
    if (pulled.cursor)
      await db.runAsync(
        "INSERT OR REPLACE INTO sync_meta (key, value) VALUES ('cursor', ?)",
        pulled.cursor,
      );
  } catch (error) {
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
