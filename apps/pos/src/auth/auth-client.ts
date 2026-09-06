import type { LoginInput, SignUpInput, UpdateStoreSettingsInput } from '@sunha/contracts';
import { apiRequest } from '../api/client';
import { getAccessToken, saveTokens } from './token-storage';

type AuthResponse = {
  data: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; tenantId: string };
    store: { id: string; tenantId: string; name: string };
  };
};

export async function signUp(input: SignUpInput): Promise<AuthResponse['data']> {
  const result = await apiRequest<AuthResponse>('/auth/signup', { method: 'POST', body: input });
  await saveTokens(result.data.accessToken, result.data.refreshToken);
  return result.data;
}

export async function login(input: LoginInput): Promise<AuthResponse['data']> {
  const result = await apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input });
  await saveTokens(result.data.accessToken, result.data.refreshToken);
  return result.data;
}

export async function updateStoreSettings(input: UpdateStoreSettingsInput): Promise<void> {
  const token = await getAccessToken();
  await apiRequest('/setup/store', {
    method: 'PATCH',
    body: input,
    accessToken: token ?? undefined,
  });
}

export async function listCatalogItems(): Promise<
  Array<{
    id: string;
    name: string;
    category?: { name: string } | null;
    units: Array<{ priceAmount: string | number | bigint }>;
  }>
> {
  const token = await getAccessToken();
  return apiRequest('/catalog/items', { accessToken: token ?? undefined });
}

export async function listInventory(): Promise<
  Array<{ item: { name: string }; quantityBase: string | number | bigint }>
> {
  const token = await getAccessToken();
  return apiRequest('/inventory/levels', { accessToken: token ?? undefined });
}
