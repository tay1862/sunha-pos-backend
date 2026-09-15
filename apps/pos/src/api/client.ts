import {
  getAccessToken,
  getEmployeeSession,
  getRefreshToken,
  getSessionContext,
  saveTokens,
} from '../auth/token-storage';
const configuredBase = process.env.EXPO_PUBLIC_API_URL ?? 'http://10.0.2.2:3001';
export const API_BASE_URL = configuredBase.replace(/\/$/, '').endsWith('/v1')
  ? configuredBase.replace(/\/$/, '')
  : `${configuredBase.replace(/\/$/, '')}/v1`;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
  }
}

let refreshing: Promise<string> | null = null;
async function refreshAccess(staleToken: string): Promise<string> {
  const current = await getAccessToken();
  if (current && current !== staleToken) return current;
  if (refreshing) return refreshing;
  refreshing = (async () => {
    const refreshToken = await getRefreshToken();
    if (!refreshToken) throw new ApiError(401, 'LOGIN_REQUIRED');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
        signal: controller.signal,
      });
      if (!response.ok) throw new ApiError(response.status, 'LOGIN_REQUIRED');
      const payload = (await response.json()) as {
        data: { accessToken: string; refreshToken: string };
      };
      if ((await getRefreshToken()) !== refreshToken) throw new ApiError(401, 'SESSION_CHANGED');
      await saveTokens(payload.data.accessToken, payload.data.refreshToken);
      return payload.data.accessToken;
    } finally {
      clearTimeout(timeout);
    }
  })().finally(() => {
    refreshing = null;
  });
  return refreshing;
}

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string } = {},
  refreshed = false,
): Promise<T> {
  const context = await getSessionContext();
  const employeeSession = await getEmployeeSession();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15_000);
  let response: Response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method: options.method ?? 'GET',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        ...(context.employeeId ? { 'x-employee-id': context.employeeId } : {}),
        ...(context.deviceId ? { 'x-device-id': context.deviceId } : {}),
        ...(employeeSession ? { 'x-employee-session': employeeSession } : {}),
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    throw new ApiError(0, error instanceof Error ? error.message : 'NETWORK_ERROR');
  } finally {
    clearTimeout(timeout);
  }
  const isText = response.headers.get('content-type')?.includes('text/csv');
  const payload = isText
    ? await response.text()
    : ((await response.json().catch(() => ({}))) as { message?: string });
  if (
    response.status === 401 &&
    options.accessToken &&
    !refreshed &&
    !path.startsWith('/auth/') &&
    path !== '/employees/verify-pin'
  ) {
    const accessToken = await refreshAccess(options.accessToken);
    return apiRequest<T>(path, { ...options, accessToken }, true);
  }
  if (!response.ok)
    throw new ApiError(
      response.status,
      typeof payload === 'string' ? payload : (payload.message ?? 'ไม่สามารถเชื่อมต่อระบบได้'),
    );
  return payload as T;
}
