import {
  NotoSansLao_400Regular,
  NotoSansLao_700Bold,
  useFonts,
} from '@expo-google-fonts/noto-sans-lao';
import { Stack } from 'expo-router';
import { ActivityIndicator, useColorScheme, View } from 'react-native';
import { TamaguiProvider } from 'tamagui';
import tamaguiConfig from '../tamagui.config';
import '../src/i18n';
import * as Sentry from '@sentry/react-native';

Sentry.init({
  dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
  environment: process.env.EXPO_PUBLIC_APP_ENV ?? (__DEV__ ? 'development' : 'production'),
  release: process.env.EXPO_PUBLIC_APP_RELEASE,
  sendDefaultPii: false,
  enableLogs: false,
});

export default Sentry.wrap(function RootLayout() {
  const [loaded] = useFonts({ NotoSansLao_400Regular, NotoSansLao_700Bold });
  const colorScheme = useColorScheme();

  if (!loaded) {
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
      <Stack screenOptions={{ headerShown: false }} />
    </TamaguiProvider>
  );
});
