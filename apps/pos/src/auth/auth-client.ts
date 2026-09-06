import type { CreateCategoryInput, CreateEmployeeInput, CreateItemInput, CreateModifierGroupInput, CreateTaxInput, LoginInput, SignUpInput, UpdateItemInput, UpdateModifierGroupInput, UpdateStoreSettingsInput, UpdateTaxInput } from '@sunha/contracts';
import { apiRequest } from '../api/client';
import { getAccessToken, saveSessionContext, saveTokens } from './token-storage';
import { readCatalogSnapshot, saveCatalogSnapshot } from '../offline/catalog-cache';

type AuthResponse = {
  data: {
    accessToken: string;
    refreshToken: string;
    user: { id: string; email: string; tenantId: string };
    store: { id: string; tenantId: string; name: string };
    ownerEmployeeId?: string;
    ownerDeviceId?: string;
  };
};

export async function signUp(input: SignUpInput): Promise<AuthResponse['data']> {
  const result = await apiRequest<AuthResponse>('/auth/signup', { method: 'POST', body: input });
  await saveTokens(result.data.accessToken, result.data.refreshToken);
  await saveSessionContext(result.data.ownerEmployeeId, result.data.ownerDeviceId);
  return result.data;
}

export async function login(input: LoginInput): Promise<AuthResponse['data']> {
  const result = await apiRequest<AuthResponse>('/auth/login', { method: 'POST', body: input });
  await saveTokens(result.data.accessToken, result.data.refreshToken);
  await saveSessionContext(result.data.ownerEmployeeId, result.data.ownerDeviceId);
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
    units: Array<{ id: string; name: string; multiplierToBase: string | number; priceAmount: string | number | bigint; sku?: string | null; barcode?: string | null }>;
  }>
> {
  const token = await getAccessToken();
  return apiRequest('/catalog/items', { accessToken: token ?? undefined });
}

export async function listCatalogCategories() {
  const token = await getAccessToken();
  return apiRequest<Array<{ id: string; name: string; color: string }>>('/catalog/categories', { accessToken: token ?? undefined });
}

export async function createCatalogCategory(input: CreateCategoryInput) {
  const token = await getAccessToken();
  return apiRequest('/catalog/categories', { method: 'POST', body: input, accessToken: token ?? undefined });
}

export async function createCatalogItem(input: CreateItemInput) {
  const token = await getAccessToken();
  return apiRequest('/catalog/items', { method: 'POST', body: input, accessToken: token ?? undefined });
}
export async function updateCatalogItem(id: string, input: UpdateItemInput) { const token = await getAccessToken(); return apiRequest(`/catalog/items/${id}`, { method: 'PATCH', body: input, accessToken: token ?? undefined }); }
export async function deleteCatalogItem(id: string) { const token = await getAccessToken(); return apiRequest(`/catalog/items/${id}`, { method: 'DELETE', accessToken: token ?? undefined }); }
export async function deleteCatalogCategory(id: string) { const token = await getAccessToken(); return apiRequest(`/catalog/categories/${id}`, { method: 'DELETE', accessToken: token ?? undefined }); }

export async function listModifierGroups() { const token = await getAccessToken(); return apiRequest<Array<{ id: string; name: string; options: Array<{ id: string; name: string; priceDeltaAmount: string | number }> }>>('/catalog/modifier-groups', { accessToken: token ?? undefined }); }
export async function createModifierGroup(input: CreateModifierGroupInput) { const token = await getAccessToken(); return apiRequest('/catalog/modifier-groups', { method: 'POST', body: input, accessToken: token ?? undefined }); }
export async function updateModifierGroup(id: string, input: UpdateModifierGroupInput) { const token = await getAccessToken(); return apiRequest(`/catalog/modifier-groups/${id}`, { method: 'PATCH', body: input, accessToken: token ?? undefined }); }
export async function deleteModifierGroup(id: string) { const token = await getAccessToken(); return apiRequest(`/catalog/modifier-groups/${id}`, { method: 'DELETE', accessToken: token ?? undefined }); }
export async function listTaxes() { const token = await getAccessToken(); return apiRequest<Array<{ id: string; name: string; rateBasisPoints: number; mode: string }>>('/catalog/taxes', { accessToken: token ?? undefined }); }
export async function createTax(input: CreateTaxInput) { const token = await getAccessToken(); return apiRequest('/catalog/taxes', { method: 'POST', body: input, accessToken: token ?? undefined }); }
export async function updateTax(id: string, input: UpdateTaxInput) { const token = await getAccessToken(); return apiRequest(`/catalog/taxes/${id}`, { method: 'PATCH', body: input, accessToken: token ?? undefined }); }
export async function deleteTax(id: string) { const token = await getAccessToken(); return apiRequest(`/catalog/taxes/${id}`, { method: 'DELETE', accessToken: token ?? undefined }); }
export async function listEmployees() { const token = await getAccessToken(); return apiRequest<Array<{ id: string; name: string; role: string; active: boolean }>>('/employees', { accessToken: token ?? undefined }); }
export async function createEmployee(input: CreateEmployeeInput) { const token = await getAccessToken(); return apiRequest('/employees', { method: 'POST', body: input, accessToken: token ?? undefined }); }
export async function updateEmployee(id: string, input: { name?: string; pin?: string; active?: boolean }) { const token = await getAccessToken(); return apiRequest(`/employees/${id}`, { method: 'PATCH', body: input, accessToken: token ?? undefined }); }

export async function getCatalogSnapshot() {
  type Snapshot = { version: string; categories: unknown[]; items: Awaited<ReturnType<typeof listCatalogItems>>; modifierGroups: unknown[]; taxes: unknown[] };
  const token = await getAccessToken();
  try {
    const result = await apiRequest<{ data: Snapshot }>('/catalog/snapshot', { accessToken: token ?? undefined });
    await saveCatalogSnapshot(result.data.version, result.data);
    return result.data;
  } catch (error) {
    const cached = await readCatalogSnapshot<Snapshot>();
    if (cached) return cached.payload;
    throw error;
  }
}

export async function listInventory(): Promise<
  Array<{ item: { name: string }; quantityBase: string | number | bigint }>
> {
  const token = await getAccessToken();
  return apiRequest('/inventory/levels', { accessToken: token ?? undefined });
}
