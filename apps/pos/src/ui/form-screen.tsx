import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, type SunhaColors } from '../design/tokens';
import { SunhaButton } from './sunha-button';

export function FormScreen({
  title,
  subtitle,
  children,
  colors = lightColors,
  onBack,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  colors?: SunhaColors;
  onBack: () => void;
}) {
  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.background }]}
      edges={['top', 'bottom']}
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentInsetAdjustmentBehavior="automatic"
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="ກັບຄືນ"
            onPress={onBack}
            style={styles.back}
          >
            <ChevronLeft color={colors.text} size={22} />
            <Text style={[styles.backText, { color: colors.textMuted }]}>ກັບຄືນ</Text>
          </Pressable>
          <View style={styles.heading}>
            <View style={[styles.logo, { backgroundColor: colors.primary }]}>
              <Text style={[styles.logoText, { color: colors.onPrimary }]}>S</Text>
            </View>
            <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
            {subtitle && (
              <Text style={[styles.subtitle, { color: colors.textMuted }]}>{subtitle}</Text>
            )}
          </View>
          <View style={styles.form}>{children}</View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function FormField({
  label,
  placeholder,
  value,
  onChangeText,
  secureTextEntry = false,
  colors = lightColors,
}: {
  label: string;
  placeholder?: string;
  value: string;
  onChangeText: (value: string) => void;
  secureTextEntry?: boolean;
  colors?: SunhaColors;
}) {
  return (
    <View style={styles.field}>
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        secureTextEntry={secureTextEntry}
        style={[
          styles.input,
          { backgroundColor: colors.surface, borderColor: colors.border, color: colors.text },
        ]}
      />
    </View>
  );
}

export function FormLink({
  children,
  onPress,
  colors = lightColors,
}: {
  children: ReactNode;
  onPress: () => void;
  colors?: SunhaColors;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.link}>
      <Text style={[styles.linkText, { color: colors.primary }]}>{children}</Text>
    </Pressable>
  );
}

export function FormButton({
  children,
  onPress,
  colors = lightColors,
  disabled = false,
  loading = false,
}: {
  children: ReactNode;
  onPress: () => void;
  colors?: SunhaColors;
  disabled?: boolean;
  loading?: boolean;
}) {
  return (
    <SunhaButton colors={colors} onPress={onPress} disabled={disabled} style={styles.formButton}>
      {loading ? 'ກຳລັງດຳເນີນການ…' : children}
    </SunhaButton>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  flex: { flex: 1 },
  content: { width: '100%', maxWidth: 520, alignSelf: 'center', padding: 22, paddingBottom: 44 },
  back: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    alignSelf: 'flex-start',
  },
  backText: { fontFamily: 'NotoSansLao_400Regular', fontSize: 12 },
  heading: { marginTop: 27, gap: 7 },
  logo: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 11,
  },
  logoText: { fontFamily: 'NotoSansLao_700Bold', fontSize: 22 },
  title: { fontFamily: 'NotoSansLao_700Bold', fontSize: 28, lineHeight: 38 },
  subtitle: { fontFamily: 'NotoSansLao_400Regular', fontSize: 14, lineHeight: 22 },
  form: { marginTop: 30, gap: 17 },
  field: { gap: 7 },
  label: { fontFamily: 'NotoSansLao_700Bold', fontSize: 13, lineHeight: 19 },
  input: {
    minHeight: 52,
    borderWidth: 1,
    borderRadius: 15,
    borderCurve: 'continuous',
    paddingHorizontal: 15,
    fontFamily: 'NotoSansLao_400Regular',
    fontSize: 14,
  },
  formButton: { minHeight: 54, marginTop: 5 },
  link: { alignSelf: 'center', padding: 8 },
  linkText: { fontFamily: 'NotoSansLao_700Bold', fontSize: 13 },
});
