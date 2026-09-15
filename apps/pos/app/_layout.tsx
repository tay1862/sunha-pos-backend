import {
  NotoSansLao_400Regular,
  NotoSansLao_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-lao';
import { Stack, usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { getAccessToken, subscribeAuth } from '../src/auth/token-storage';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import tamaguiConfig from '../tamagui.config';
import '../src/i18n';
import * as Sentry from '@sentry/react-native';

const expoEnv =
  (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};

Sentry.init({
  dsn: expoEnv.EXPO_PUBLIC_SENTRY_DSN,
  environment: expoEnv.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
  release: expoEnv.EXPO_PUBLIC_APP_RELEASE,
  sendDefaultPii: false,
  enableLogs: false,
});

export default Sentry.wrap(function RootLayout() {
  const [loaded] = useFonts({ NotoSansLao_400Regular, NotoSansLao_700Bold });
  const colorScheme = useColorScheme();
  const path = usePathname();
  const [authenticated, setAuthenticated] = useState<boolean | null>(null);
  useEffect(() => subscribeAuth(setAuthenticated), []);
  useEffect(() => {
    let active = true;
    getAccessToken()
      .then((token) => {
        if (active) setAuthenticated(Boolean(token));
      })
      .catch(() => {
        if (active) setAuthenticated(false);
      });
    return () => {
      active = false;
    };
  }, [path]);

  if (!loaded || authenticated === null) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <TamaguiProvider
      config={tamaguiConfig}
      defaultTheme={colorScheme === 'dark' ? 'sunhaDark' : 'sunhaLight'}
    >
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="create-account" />
        <Stack.Protected guard={authenticated}>
          {[
            'index',
            'setup-store',
            'employee-pin',
            'items',
            'employees',
            'modifiers',
            'taxes',
            'stock',
            'shifts',
            'receipts',
            'reports',
            'settings',
            'printers',
            'barcode',
            'sync',
          ].map((name) => (
            <Stack.Screen key={name} name={name} />
          ))}
        </Stack.Protected>
      </Stack>
    </TamaguiProvider>
  );
});
