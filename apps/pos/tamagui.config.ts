import { defaultConfig } from '@tamagui/config/v5';
import { createTamagui } from 'tamagui';

export const tamaguiConfig = createTamagui({
  ...defaultConfig,
  themes: {
    ...defaultConfig.themes,
    sunhaLight: {
      ...defaultConfig.themes.light,
      background: '#F3F6F5',
      color: '#142522',
      borderColor: '#DCE4E1',
    },
    sunhaDark: {
      ...defaultConfig.themes.dark,
      background: '#111513',
      color: '#F5F7F6',
      borderColor: '#2B3431',
    },
  },
});

export default tamaguiConfig;

export type SunhaTamaguiConfig = typeof tamaguiConfig;

declare module 'tamagui' {
  interface TamaguiCustomConfig extends SunhaTamaguiConfig {}
}
