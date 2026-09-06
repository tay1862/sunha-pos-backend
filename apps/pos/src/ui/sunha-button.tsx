import type { ComponentProps, ReactNode } from 'react';
import { Pressable, StyleSheet, Text, type ViewStyle } from 'react-native';
import type { SunhaColors } from '../design/tokens';

type Props = Pick<
  ComponentProps<typeof Pressable>,
  'onPress' | 'disabled' | 'accessibilityLabel'
> & {
  children: ReactNode;
  colors: SunhaColors;
  variant?: 'primary' | 'secondary' | 'ghost';
  style?: ViewStyle;
};

export function SunhaButton({
  children,
  colors,
  variant = 'primary',
  style,
  disabled,
  ...pressableProps
}: Props) {
  const palette = {
    primary: { background: colors.primary, foreground: colors.onPrimary, border: colors.primary },
    secondary: { background: colors.soft, foreground: colors.text, border: colors.soft },
    ghost: { background: 'transparent', foreground: colors.text, border: colors.border },
  }[variant];

  return (
    <Pressable
      {...pressableProps}
      accessibilityRole="button"
      disabled={disabled}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor:
            pressed && variant === 'primary' ? colors.primaryPressed : palette.background,
          borderColor: palette.border,
          opacity: disabled ? 0.45 : pressed && variant !== 'primary' ? 0.7 : 1,
        },
        style,
      ]}
    >
      <Text style={[styles.label, { color: palette.foreground }]}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderWidth: 1,
    borderRadius: 16,
    borderCurve: 'continuous',
  },
  label: { fontFamily: 'NotoSansLao_700Bold', fontSize: 15, lineHeight: 22 },
});
