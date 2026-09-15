import { Boxes } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { lightColors } from '../src/design/tokens';
import { adjustInventory, listEmployees, listInventory } from '../src/auth/auth-client';
export default function StockScreen() {
  const router = useRouter();
  const [levels, setLevels] = useState<Awaited<ReturnType<typeof listInventory>>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<string>(); const [quantity, setQuantity] = useState(''); const [reason, setReason] = useState(''); const [managerId, setManagerId] = useState(''); const [pin, setPin] = useState(''); const [message, setMessage] = useState('');
  useEffect(() => {
    void Promise.all([listInventory(), listEmployees()])
      .then(([nextLevels, employees]) => { setLevels(nextLevels); setSelectedItem(nextLevels[0]?.item.id); setManagerId(employees.find((employee) => employee.role !== 'CASHIER')?.id ?? ''); })
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
      {!loading && <View style={styles.form}><TextInput placeholder="ຈຳນວນ (+ ຮັບເຂົ້າ / - ປັບລົງ)" value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" style={styles.input} /><TextInput placeholder="ເຫດຜົນ" value={reason} onChangeText={setReason} style={styles.input} /><TextInput placeholder="Manager employee ID" value={managerId} onChangeText={setManagerId} style={styles.input} /><TextInput placeholder="Manager PIN" value={pin} onChangeText={setPin} secureTextEntry keyboardType="number-pad" style={styles.input} /><Text style={styles.button} onPress={() => void adjustInventory({ itemId: selectedItem ?? '', quantityBase: quantity, reason, managerEmployeeId: managerId, managerPin: pin }).then(() => { setMessage('ປັບສະຕັອກສຳເລັດ'); return listInventory(); }).then(setLevels).catch((error) => setMessage(error instanceof Error ? error.message : 'ປັບສະຕັອກບໍ່ສຳເລັດ'))}>ບັນທຶກການປັບສະຕັອກ</Text>{message ? <Text style={styles.meta}>{message}</Text> : null}</View>}
      {loading ? (
        <ActivityIndicator color={lightColors.primary} />
      ) : (
        <FlatList
          data={levels}
          keyExtractor={(item) => item.item.id}
          ListEmptyComponent={<Text style={styles.empty}>ຍັງບໍ່ມີລາຍການສະຕັອກ</Text>}
          renderItem={({ item }) => (
            <View style={styles.row}>
              <Text onPress={() => setSelectedItem(item.item.id)} style={[styles.name, selectedItem === item.item.id && { color: lightColors.primary }]}>{item.item.name}</Text>
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
  form: { backgroundColor: lightColors.surface, padding: 14, borderRadius: 12, gap: 8, marginBottom: 14 },
  input: { borderWidth: 1, borderColor: lightColors.border, borderRadius: 8, padding: 10, color: lightColors.text },
  button: { backgroundColor: lightColors.primary, color: '#fff', padding: 12, borderRadius: 8, textAlign: 'center' },
  meta: { color: lightColors.textMuted },
});
