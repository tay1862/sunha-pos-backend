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

export default function RootLayout() {
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
}
