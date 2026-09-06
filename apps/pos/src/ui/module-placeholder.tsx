import { ChevronLeft } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lightColors, type SunhaColors } from '../design/tokens';

export function ModulePlaceholder({
  title,
  description,
  icon,
  onBack,
  colors = lightColors,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  onBack: () => void;
  colors?: SunhaColors;
}) {
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="ກັບໄປໜ້າຂາຍ"
          onPress={onBack}
          style={styles.back}
        >
          <ChevronLeft color={colors.text} size={20} />
          <Text style={[styles.backText, { color: colors.textMuted }]}>ກັບໜ້າຂາຍ</Text>
        </Pressable>
        <View style={[styles.icon, { backgroundColor: colors.soft }]}>{icon}</View>
        <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
        <Text style={[styles.description, { color: colors.textMuted }]}>{description}</Text>
        <View
          style={[styles.notice, { borderColor: colors.border, backgroundColor: colors.surface }]}
        >
          <Text style={[styles.noticeText, { color: colors.textMuted }]}>
            ໜ້ານີ້ຈະເຊື່ອມກັບ API ໃນ Phase ຕໍ່ໄປ
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  container: { flex: 1, alignItems: 'center', padding: 22 },
  back: {
    alignSelf: 'flex-start',
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  backText: { fontFamily: 'NotoSansLao_400Regular', fontSize: 12 },
  icon: {
    width: 58,
    height: 58,
    borderRadius: 19,
    marginTop: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontFamily: 'NotoSansLao_700Bold', fontSize: 24, marginTop: 20 },
  description: {
    fontFamily: 'NotoSansLao_400Regular',
    fontSize: 14,
    textAlign: 'center',
    lineHeight: 23,
    marginTop: 7,
    maxWidth: 300,
  },
  notice: { borderWidth: 1, borderRadius: 14, padding: 13, marginTop: 26 },
  noticeText: { fontFamily: 'NotoSansLao_400Regular', fontSize: 12 },
});
