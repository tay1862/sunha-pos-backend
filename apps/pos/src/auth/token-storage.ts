import * as SecureStore from 'expo-secure-store';

const accessKey = 'sunha.access-token';
const refreshKey = 'sunha.refresh-token';
const employeeKey = 'sunha.employee-id';
const deviceKey = 'sunha.device-id';

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(accessKey, accessToken),
    SecureStore.setItemAsync(refreshKey, refreshToken),
  ]);
}
export async function saveSessionContext(employeeId?: string, deviceId?: string): Promise<void> {
  await Promise.all([
    employeeId ? SecureStore.setItemAsync(employeeKey, employeeId) : Promise.resolve(),
    deviceId ? SecureStore.setItemAsync(deviceKey, deviceId) : Promise.resolve(),
  ]);
}
export async function getSessionContext() {
  const [employeeId, deviceId] = await Promise.all([SecureStore.getItemAsync(employeeKey), SecureStore.getItemAsync(deviceKey)]);
  return { employeeId, deviceId };
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(accessKey);
}
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(accessKey),
    SecureStore.deleteItemAsync(refreshKey),
    SecureStore.deleteItemAsync(employeeKey),
    SecureStore.deleteItemAsync(deviceKey),
  ]);
}
