import * as SecureStore from 'expo-secure-store';

const accessKey = 'sunha.access-token';
const refreshKey = 'sunha.refresh-token';

export async function saveTokens(accessToken: string, refreshToken: string): Promise<void> {
  await Promise.all([
    SecureStore.setItemAsync(accessKey, accessToken),
    SecureStore.setItemAsync(refreshKey, refreshToken),
  ]);
}

export async function getAccessToken(): Promise<string | null> {
  return SecureStore.getItemAsync(accessKey);
}
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(accessKey),
    SecureStore.deleteItemAsync(refreshKey),
  ]);
}
