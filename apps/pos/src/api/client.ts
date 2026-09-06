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

export async function apiRequest<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string } = {},
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });
  const payload = (await response.json().catch(() => ({}))) as { message?: string };
  if (!response.ok)
    throw new ApiError(response.status, payload.message ?? 'ไม่สามารถเชื่อมต่อระบบได้');
  return payload as T;
}
