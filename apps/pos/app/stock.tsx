import { Boxes } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lightColors } from '../src/design/tokens';
import { listInventory } from '../src/auth/auth-client';
export default function StockScreen() {
  const router = useRouter();
  const [levels, setLevels] = useState<Awaited<ReturnType<typeof listInventory>>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void listInventory()
      .then(setLevels)
      .finally(() => setLoading(false));
  }, []);
  return (
    <View style={styles.safe}>
      <Text onPress={() => router.replace('/')} style={styles.back}>
        ‹ ກັບໜ້າຂາຍ
      </Text>
      <View style={styles.heading}>
        <Boxes color={lightColors.primary} size={24} />
        <Text style={styles.title}>ສະຕັອກ</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={lightColors.primary} />
      ) : (
        <FlatList
          data={levels}
          keyExtractor={(item) => item.item.name}
          ListEmptyComponent={<Text style={styles.empty}>ຍັງບໍ່ມີລາຍການສະຕັອກ</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text style={styles.name}>{item.item.name}</Text>
              <Text style={styles.qty}>{String(item.quantityBase)}</Text>
            </View>
          )}
        />
      )}{' '}
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: lightColors.background, padding: 22 },
  back: { color: lightColors.textMuted, fontSize: 13, marginBottom: 28 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  title: { color: lightColors.text, fontSize: 24, fontFamily: 'NotoSansLao_700Bold' },
  row: {
    backgroundColor: lightColors.surface,
    borderColor: lightColors.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: { color: lightColors.text, fontFamily: 'NotoSansLao_700Bold', fontSize: 15 },
  qty: { color: lightColors.primary, fontFamily: 'NotoSansLao_700Bold' },
  empty: { color: lightColors.textMuted, textAlign: 'center', marginTop: 80 },
});
