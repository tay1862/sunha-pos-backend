import { Package } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lightColors } from '../src/design/tokens';
import {
  createCatalogCategory,
  createCatalogItem,
  deleteCatalogCategory,
  deleteCatalogItem,
  listCatalogCategories,
  listCatalogItems,
  updateCatalogItem,
} from '../src/auth/auth-client';
export default function ItemsScreen() {
  const router = useRouter();
  const [items, setItems] = useState<Awaited<ReturnType<typeof listCatalogItems>>>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [barcode, setBarcode] = useState('');
  const [unitName, setUnitName] = useState('ອັນ');
  const [multiplier, setMultiplier] = useState('1');
  const [sku, setSku] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoryName, setCategoryName] = useState('');
  const [message, setMessage] = useState('');
  const [categories, setCategories] = useState<Awaited<ReturnType<typeof listCatalogCategories>>>(
    [],
  );
  useEffect(() => {
    void Promise.all([listCatalogItems(), listCatalogCategories()])
      .then(([nextItems, nextCategories]) => {
        setItems(nextItems);
        setCategories(nextCategories);
      })
      .finally(() => setLoading(false));
  }, []);
  const createItem = async () => {
    setMessage('');
    try {
      const unit = {
        name: unitName || 'ອັນ',
        multiplierToBase: multiplier || '1',
        price: { amount: price, currency: 'LAK' as const },
        sku: sku || undefined,
        barcode: barcode || undefined,
      };
      if (editingId)
        await updateCatalogItem(editingId, {
          name,
          units: [{ ...unit, id: items.find((item) => item.id === editingId)?.units[0]?.id }],
        });
      else
        await createCatalogItem({
          name,
          baseUnitName: unit.name,
          trackStock: false,
          units: [unit],
        });
      setItems(await listCatalogItems());
      setName('');
      setPrice('');
      setBarcode('');
      setMessage('ສ້າງສິນຄ້າສຳເລັດ');
      setUnitName('ອັນ');
      setMultiplier('1');
      setSku('');
      setEditingId(null);
    } catch {
      setMessage('ສ້າງສິນຄ້າບໍ່ສຳເລັດ');
    }
  };
  const editItem = (item: (typeof items)[number]) => {
    const unit = item.units[0];
    setEditingId(item.id);
    setShowCreate(true);
    setName(item.name);
    setPrice(String(unit?.priceAmount ?? ''));
    setUnitName(unit?.name ?? 'ອັນ');
    setMultiplier(String(unit?.multiplierToBase ?? '1'));
    setSku(unit?.sku ?? '');
    setBarcode(unit?.barcode ?? '');
  };
  const removeItem = async (id: string) => {
    try {
      await deleteCatalogItem(id);
      setItems(await listCatalogItems());
      setMessage('ປິດໃຊ້ງານສິນຄ້າແລ້ວ');
    } catch {
      setMessage('ລຶບສິນຄ້າບໍ່ສຳເລັດ');
    }
  };
  const removeCategory = async (id: string) => {
    try {
      await deleteCatalogCategory(id);
      setCategories(await listCatalogCategories());
      setMessage('ລຶບໝວດໝູ່ແລ້ວ');
    } catch {
      setMessage('ລຶບບໍ່ໄດ້: ອາດຍັງມີສິນຄ້າໃຊ້ຢູ່');
    }
  };
  const createCategory = async () => {
    if (!categoryName.trim()) return;
    try {
      await createCatalogCategory({ name: categoryName.trim(), color: '#087F8C' });
      setCategories(await listCatalogCategories());
      setCategoryName('');
      setMessage('ສ້າງໝວດໝູ່ສຳເລັດ');
    } catch {
      setMessage('ສ້າງໝວດໝູ່ບໍ່ສຳເລັດ');
    }
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
      <Text
        onPress={() => {
          setEditingId(null);
          setShowCreate((value) => !value);
        }}
        style={styles.action}
      >
        {showCreate ? '− ປິດຟອມ' : '+ ເພີ່ມສິນຄ້າ'}
      </Text>
      {showCreate ? (
        <View style={styles.form}>
          <TextInput
            placeholder="ຊື່ສິນຄ້າ"
            value={name}
            onChangeText={setName}
            style={styles.input}
          />
          <TextInput
            placeholder="ຊື່ໜ່ວຍ (ເຊັ່ນ ອັນ/ແພັກ)"
            value={unitName}
            onChangeText={setUnitName}
            style={styles.input}
          />
          <TextInput
            placeholder="Conversion ໄປຫາໜ່ວຍຖານ"
            value={multiplier}
            onChangeText={setMultiplier}
            keyboardType="decimal-pad"
            style={styles.input}
          />
          <TextInput
            placeholder="ລາຄາ (LAK)"
            value={price}
            onChangeText={setPrice}
            keyboardType="number-pad"
            style={styles.input}
          />
          <TextInput
            placeholder="SKU (ຖ້າມີ)"
            value={sku}
            onChangeText={setSku}
            style={styles.input}
          />
          <TextInput
            placeholder="Barcode (ຖ້າມີ)"
            value={barcode}
            onChangeText={setBarcode}
            style={styles.input}
          />
          <Text onPress={() => void createItem()} style={styles.button}>
            {editingId ? 'ອັບເດດສິນຄ້າ' : 'ບັນທຶກສິນຄ້າ'}
          </Text>
          <View style={styles.categoryRow}>
            <TextInput
              placeholder="ຊື່ໝວດໝູ່ໃໝ່"
              value={categoryName}
              onChangeText={setCategoryName}
              style={[styles.input, { flex: 1 }]}
            />
            <Text onPress={() => void createCategory()} style={styles.smallButton}>
              ເພີ່ມໝວດ
            </Text>
          </View>
          {categories.length ? (
            <View>
              {categories.map((category) => (
                <View key={category.id} style={styles.categoryRow}>
                  <Text style={styles.meta}>{category.name}</Text>
                  <Text onPress={() => void removeCategory(category.id)} style={styles.delete}>
                    ລຶບ
                  </Text>
                </View>
              ))}
            </View>
          ) : null}
          {message ? <Text style={styles.message}>{message}</Text> : null}
        </View>
      ) : null}
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
              <View>
                <Text style={styles.price}>{String(item.units[0]?.priceAmount ?? 0)} ₭</Text>
                <Text onPress={() => editItem(item)} style={styles.edit}>
                  ແກ້ໄຂ
                </Text>
                <Text onPress={() => void removeItem(item.id)} style={styles.delete}>
                  ປິດໃຊ້ງານ
                </Text>
              </View>
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
  action: {
    alignSelf: 'flex-end',
    color: lightColors.primary,
    fontFamily: 'NotoSansLao_700Bold',
    marginBottom: 12,
  },
  form: {
    backgroundColor: lightColors.surface,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    gap: 8,
  },
  input: {
    backgroundColor: lightColors.background,
    borderColor: lightColors.border,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    color: lightColors.text,
  },
  button: {
    backgroundColor: lightColors.primary,
    color: '#fff',
    textAlign: 'center',
    padding: 12,
    borderRadius: 10,
    fontFamily: 'NotoSansLao_700Bold',
  },
  smallButton: { color: lightColors.primary, padding: 10, fontFamily: 'NotoSansLao_700Bold' },
  categoryRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  message: { color: lightColors.primary, fontSize: 12 },
  edit: { color: lightColors.primary, fontSize: 12, marginTop: 6, textAlign: 'right' },
  delete: { color: '#B42318', fontSize: 12, marginTop: 4 },
});
