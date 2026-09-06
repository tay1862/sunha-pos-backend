import { Package } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lightColors } from '../src/design/tokens';
import { listCatalogItems } from '../src/auth/auth-client';
export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Awaited<ReturnType<typeof listCatalogItems>>>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    void listCatalogItems()
      .then(setItems)
      .finally(() => setLoading(false));
  }, []);
  return (
    <View style={styles.safe}>
      <Text onPress={() => router.replace('/')} style={styles.back}>
        ‹ ກັບໜ້າຂາຍ
      </Text>
      <View style={styles.heading}>
        <Package color={lightColors.primary} size={24} />
        <Text style={styles.title}>ສິນຄ້າ</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={lightColors.primary} />
      ) : (
        <FlatList
          data={items}
          keyExtractor={(item) => item.id}
          ListEmptyComponent={
            <Text style={styles.empty}>ຍັງບໍ່ມີສິນຄ້າ ຫຼື ຕ້ອງເຂົ້າລະບົບກ່ອນ</Text>
          }
          renderItem={({ item }) => (
            <View style={styles.row}>
              <View>
                <Text style={styles.name}>{item.name}</Text>
                <Text style={styles.meta}>{item.category?.name ?? 'ບໍ່ມີໝວດໝູ່'}</Text>
              </View>
              <Text style={styles.price}>{String(item.units[0]?.priceAmount ?? 0)} ₭</Text>
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
  meta: { color: lightColors.textMuted, fontSize: 12, marginTop: 3 },
  price: { color: lightColors.primary, fontFamily: 'NotoSansLao_700Bold' },
  empty: { color: lightColors.textMuted, textAlign: 'center', marginTop: 80, lineHeight: 23 },
});
