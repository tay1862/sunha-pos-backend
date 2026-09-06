export const lightColors = {
  background: '#F3F6F5',
  surface: '#FFFFFF',
  surfaceRaised: '#FFFFFF',
  text: '#142522',
  textMuted: '#687974',
  primary: '#087F8C',
  primaryPressed: '#066A75',
  onPrimary: '#FFFFFF',
  border: '#DCE4E1',
  soft: '#E9F3F2',
  success: '#198754',
  warning: '#C96B18',
  danger: '#C43D32',
  scrim: 'rgba(20, 37, 34, 0.42)',
} as const;

export const darkColors = {
  background: '#111513',
  surface: '#1A201E',
  surfaceRaised: '#222926',
  text: '#F5F7F6',
  textMuted: '#9EACA7',
  primary: '#F18A31',
  primaryPressed: '#D87522',
  onPrimary: '#1D1006',
  border: '#2B3431',
  soft: '#27302D',
  success: '#43B97C',
  warning: '#F2A65A',
  danger: '#FF756B',
  scrim: 'rgba(0, 0, 0, 0.62)',
} as const;

export type SunhaColors = typeof lightColors | typeof darkColors;
