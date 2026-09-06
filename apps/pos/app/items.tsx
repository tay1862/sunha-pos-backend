import { Package } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lightColors } from '../src/design/tokens';
import { createCatalogCategory, createCatalogItem, listCatalogCategories, listCatalogItems } from '../src/auth/auth-client';
export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Awaited<ReturnType<typeof listCatalogItems>>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof listCatalogCategories>>>([]);
  useEffect(() => {
    void Promise.all([listCatalogItems(), listCatalogCategories()])
      .then(([nextItems, nextCategories]) => { setItems(nextItems); setCategories(nextCategories); })
      .finally(() => setLoading(false));
  }, []);
  const createItem = async () => {
    setMessage('');
    try {
      await createCatalogItem({ name, baseUnitName: 'ອັນ', trackStock: false, units: [{ name: 'ອັນ', multiplierToBase: '1', price: { amount: price, currency: 'LAK' }, barcode: barcode || undefined }] });
      setItems(await listCatalogItems()); setName(''); setPrice(''); setBarcode(''); setMessage('ສ້າງສິນຄ້າສຳເລັດ');
    } catch { setMessage('ສ້າງສິນຄ້າບໍ່ສຳເລັດ'); }
  };
  const createCategory = async () => {
    if (!categoryName.trim()) return;
    try { await createCatalogCategory({ name: categoryName.trim(), color: '#087F8C' }); setCategories(await listCatalogCategories()); setCategoryName(''); setMessage('ສ້າງໝວດໝູ່ສຳເລັດ'); } catch { setMessage('ສ້າງໝວດໝູ່ບໍ່ສຳເລັດ'); }
  };
  return (
    <View style={styles.safe}>
      <Text onPress={() => router.replace('/')} style={styles.back}>
        ‹ ກັບໜ້າຂາຍ
      </Text>
      <View style={styles.heading}>
        <Package color={lightColors.primary} size={24} />
        <Text style={styles.title}>ສິນຄ້າ</Text>
      </View>
      <Text onPress={() => setShowCreate((value) => !value)} style={styles.action}>{showCreate ? '− ປິດຟອມ' : '+ ເພີ່ມສິນຄ້າ'}</Text>
      {showCreate ? <View style={styles.form}>
        <TextInput placeholder="ຊື່ສິນຄ້າ" value={name} onChangeText={setName} style={styles.input} />
        <TextInput placeholder="ລາຄາ (LAK)" value={price} onChangeText={setPrice} keyboardType="number-pad" style={styles.input} />
        <TextInput placeholder="Barcode (ຖ້າມີ)" value={barcode} onChangeText={setBarcode} style={styles.input} />
        <Text onPress={() => void createItem()} style={styles.button}>ບັນທຶກສິນຄ້າ</Text>
        <View style={styles.categoryRow}><TextInput placeholder="ຊື່ໝວດໝູ່ໃໝ່" value={categoryName} onChangeText={setCategoryName} style={[styles.input, { flex: 1 }]} /><Text onPress={() => void createCategory()} style={styles.smallButton}>ເພີ່ມໝວດ</Text></View>
        {categories.length ? <Text style={styles.meta}>ໝວດໝູ່: {categories.map((category) => category.name).join(' · ')}</Text> : null}
        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View> : null}
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
  action: { alignSelf: 'flex-end', color: lightColors.primary, fontFamily: 'NotoSansLao_700Bold', marginBottom: 12 },
  form: { backgroundColor: lightColors.surface, borderRadius: 14, padding: 14, marginBottom: 16, gap: 8 },
  input: { backgroundColor: lightColors.background, borderColor: lightColors.border, borderWidth: 1, borderRadius: 10, padding: 10, color: lightColors.text },
  button: { backgroundColor: lightColors.primary, color: '#fff', textAlign: 'center', padding: 12, borderRadius: 10, fontFamily: 'NotoSansLao_700Bold' },
  smallButton: { color: lightColors.primary, padding: 10, fontFamily: 'NotoSansLao_700Bold' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  message: { color: lightColors.primary, fontSize: 12 },
});
