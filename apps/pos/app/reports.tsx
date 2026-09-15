import { BarChart3 } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, Text, TextInput, View, Pressable } from 'react-native';
import { useRouter } from 'expo-router';
import { lightColors } from '../src/design/tokens';
import { exportReportCsv, getReport } from '../src/auth/auth-client';
export default function ReportsScreen() {
  const router = useRouter();
  const [sales, setSales] = useState<{
    totalAmount: string;
    orderCount: number;
    refundAmount: string;
  } | null>(null);
  const [payments, setPayments] = useState<
    Array<{ type: string; amount: string; count: number; unverified: number }>
  >([]);
  const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [error, setError] = useState('');
  const load = () => { setError(''); void Promise.all([getReport('sales', from || undefined, to || undefined), getReport('payments', from || undefined, to || undefined)]).then(([sale, payment]) => { setSales(sale as typeof sales); setPayments(payment as typeof payments); }).catch((cause) => setError(cause instanceof Error ? cause.message : 'ໂຫຼດບໍ່ສຳເລັດ')); };
  useEffect(() => {
    load();
  }, []);
  const exportCsv = async () => { try { const csv = await exportReportCsv('sales', from || undefined, to || undefined); await Share.share({ message: csv }); } catch (cause) { Alert.alert('Export', cause instanceof Error ? cause.message : 'Export ບໍ່ສຳເລັດ'); } };
  return (
    <View style={styles.page}>
      <Text onPress={() => router.replace('/')} style={styles.back}>
        ‹ ກັບໜ້າຂາຍ
      </Text>
      <View style={styles.heading}>
        <BarChart3 color={lightColors.primary} size={25} />
        <Text style={styles.title}>ລາຍງານ</Text>
      </View>
      <View style={styles.filters}><TextInput value={from} onChangeText={setFrom} placeholder="From ISO datetime" style={styles.input} /><TextInput value={to} onChangeText={setTo} placeholder="To ISO datetime" style={styles.input} /><Pressable onPress={load} style={styles.filterButton}><Text style={{ color: '#fff' }}>ໂຫຼດ</Text></Pressable><Pressable onPress={() => void exportCsv()} style={styles.filterButton}><Text style={{ color: '#fff' }}>CSV</Text></Pressable></View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!sales ? (
        <ActivityIndicator color={lightColors.primary} />
      ) : (
        <>
          <View style={styles.hero}>
            <Text style={styles.label}>ຍອດຂາຍສຸດທິ</Text>
            <Text style={styles.total}>{Number(sales.totalAmount).toLocaleString()} ₭</Text>
            <Text style={styles.meta}>
              {sales.orderCount} ໃບເສັດ · refund {Number(sales.refundAmount).toLocaleString()} ₭
            </Text>
          </View>
          <Text style={styles.section}>ຕາມວິທີຊຳລະ</Text>
          {payments.map((payment) => (
            <View key={payment.type} style={styles.row}>
              <Text style={styles.name}>{payment.type}</Text>
              <Text style={styles.amount}>
                {Number(payment.amount).toLocaleString()} ₭ · {payment.count}
              </Text>
            </View>
          ))}
        </>
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: lightColors.background, padding: 22 },
  back: { color: lightColors.textMuted, fontSize: 13, marginBottom: 24 },
  heading: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  title: { color: lightColors.text, fontFamily: 'NotoSansLao_700Bold', fontSize: 24 },
  hero: { backgroundColor: lightColors.primary, borderRadius: 18, padding: 18, marginBottom: 22 },
  label: { color: lightColors.onPrimary, fontFamily: 'NotoSansLao_400Regular', fontSize: 12 },
  total: {
    color: lightColors.onPrimary,
    fontFamily: 'NotoSansLao_700Bold',
    fontSize: 28,
    marginVertical: 7,
  },
  meta: { color: lightColors.onPrimary, fontFamily: 'NotoSansLao_400Regular', fontSize: 11 },
  section: {
    color: lightColors.text,
    fontFamily: 'NotoSansLao_700Bold',
    fontSize: 15,
    marginBottom: 9,
  },
  row: {
    backgroundColor: lightColors.surface,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 13,
    padding: 14,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  name: { color: lightColors.text, fontFamily: 'NotoSansLao_700Bold', fontSize: 12 },
  amount: { color: lightColors.primary, fontFamily: 'NotoSansLao_700Bold', fontSize: 12 },
  filters: { gap: 8, marginBottom: 14 }, input: { borderWidth: 1, borderColor: lightColors.border, borderRadius: 8, padding: 10, color: lightColors.text }, filterButton: { backgroundColor: lightColors.primary, padding: 10, borderRadius: 8, alignItems: 'center' }, error: { color: '#B42318', marginBottom: 8 },
});
