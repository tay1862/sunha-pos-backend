import * as SecureStore from 'expo-secure-store';

const accessKey = 'sunha.access-token';
const refreshKey = 'sunha.refresh-token';
const employeeKey = 'sunha.employee-id';
const deviceKey = 'sunha.device-id';
const employeeSessionKey = 'sunha.employee-session';
const tenantKey = 'sunha.tenant-id';
const storeKey = 'sunha.store-id';
const listeners = new Set<(authenticated: boolean) => void>();
export function subscribeAuth(listener: (authenticated: boolean) => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(accessKey, accessToken),
    SecureStore.setItemAsync(refreshKey, refreshToken),
  ]);
  listeners.forEach((listener) => listener(true));
}
export async function saveSessionContext(
  employeeId?: string,
  deviceId?: string,
  tenantId?: string,
  storeId?: string,
): Promise<void> {
  await Promise.all([
    employeeId ? SecureStore.setItemAsync(employeeKey, employeeId) : Promise.resolve(),
    deviceId ? SecureStore.setItemAsync(deviceKey, deviceId) : Promise.resolve(),
    tenantId ? SecureStore.setItemAsync(tenantKey, tenantId) : Promise.resolve(),
    storeId ? SecureStore.setItemAsync(storeKey, storeId) : Promise.resolve(),
  ]);
}
export async function saveEmployeeSession(token: string): Promise<void> {
  await SecureStore.setItemAsync(employeeSessionKey, token);
}
export async function getSessionContext() {
  const [employeeId, deviceId] = await Promise.all([
    SecureStore.getItemAsync(employeeKey),
    SecureStore.getItemAsync(deviceKey),
  ]);
  const tenantId = await SecureStore.getItemAsync(tenantKey);
  const storeId = await SecureStore.getItemAsync(storeKey);
  return { employeeId, deviceId, tenantId, storeId };
}

export async function getEmployeeSession(): Promise<string | null> {
  return SecureStore.getItemAsync(employeeSessionKey);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(accessKey);
}
export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(refreshKey);
}
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(accessKey),
    SecureStore.deleteItemAsync(refreshKey),
    SecureStore.deleteItemAsync(employeeKey),
    SecureStore.deleteItemAsync(deviceKey),
    SecureStore.deleteItemAsync(employeeSessionKey),
    SecureStore.deleteItemAsync(tenantKey),
    SecureStore.deleteItemAsync(storeKey),
  ]);
  listeners.forEach((listener) => listener(false));
}
