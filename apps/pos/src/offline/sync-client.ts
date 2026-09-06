import { apiRequest } from '../api/client';
import { getAccessToken } from '../auth/token-storage';
import { enqueueOperation, markOperation, pendingOperations } from './outbox';

export async function syncPending(deviceId: string, employeeId: string): Promise<void> {
  const operations = await pendingOperations();
  if (!operations.length) return;
  const token = await getAccessToken();
  try {
    const result = await apiRequest<{
      results: Array<{ operationId: string; status: 'ACKED' | 'FAILED_REVIEW'; error?: string }>;
    }>('/sync/push', {
      method: 'POST',
      accessToken: token ?? undefined,
      body: {
        deviceId,
        employeeId,
        operations: operations.map((operation) => ({
          ...operation,
          occurredAtDevice: new Date().toISOString(),
        })),
      },
    });
    await Promise.all(
      result.results.map((item) => markOperation(item.operationId, item.status, item.error)),
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
