import { useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRouter } from 'expo-router';
import { closeShift, cashMovement, openShift } from '../src/auth/auth-client';
import { lightColors } from '../src/design/tokens';

export default function ShiftsScreen() {
  const router = useRouter();
  const [opening, setOpening] = useState('0');
  const [closing, setClosing] = useState('');
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const action = async (fn: () => Promise<unknown>, success: string) => {
    try {
      const result = await fn();
      Alert.alert(
        success,
        result && typeof result === 'object' && 'expectedAmount' in result
          ? `ຍອດຄາດຄະເນ: ${(result as { expectedAmount: string }).expectedAmount} ₭`
          : undefined,
      );
    } catch (error) {
      Alert.alert('ດຳເນີນການບໍ່ສຳເລັດ', error instanceof Error ? error.message : 'ລອງໃໝ່');
    }
  };
  return (
    <View style={styles.page}>
      <Text onPress={() => router.replace('/')} style={styles.back}>
        ‹ ກັບໜ້າຂາຍ
      </Text>
      <Text style={styles.title}>ກະເງິນຮ້ານ</Text>
      <Text style={styles.note}>ຮ້ານໃຊ້ກະຮ່ວມກັນ 1 ກະ · ປິດກະແບບ blind count</Text>
      <Text style={styles.label}>ເປີດກະ · ເງິນເລີ່ມຕົ້ນ</Text>
      <TextInput
        value={opening}
        onChangeText={setOpening}
        keyboardType="number-pad"
        style={styles.input}
      />
      <Pressable
        style={styles.primary}
        onPress={() => void action(() => openShift(opening), 'ເປີດກະສຳເລັດ')}
      >
        <Text style={styles.primaryText}>ເປີດກະ</Text>
      </Pressable>
      <Text style={styles.label}>Cash in/out</Text>
      <TextInput
        value={amount}
        onChangeText={setAmount}
        keyboardType="number-pad"
        placeholder="ຈຳນວນ"
        style={styles.input}
      />
      <TextInput
        value={reason}
        onChangeText={setReason}
        placeholder="ເຫດຜົນ"
        style={styles.input}
      />
      <View style={styles.row}>
        <Pressable
          style={styles.secondary}
          onPress={() =>
            void action(() => cashMovement({ amount, type: 'CASH_IN', reason }), 'Cash in ສຳເລັດ')
          }
        >
          <Text style={styles.secondaryText}>Cash in</Text>
        </Pressable>
        <Pressable
          style={styles.secondary}
          onPress={() =>
            void action(
              () => cashMovement({ amount: `-${amount}`, type: 'CASH_OUT', reason }),
              'Cash out ສຳເລັດ',
            )
          }
        >
          <Text style={styles.secondaryText}>Cash out</Text>
        </Pressable>
      </View>
      <Text style={styles.label}>ປິດກະ · ກອກເງິນສົດຈິງ (ຍັງບໍ່ເຫັນຍອດຄາດຄະເນ)</Text>
      <TextInput
        value={closing}
        onChangeText={setClosing}
        keyboardType="number-pad"
        style={styles.input}
      />
      <Pressable
        style={styles.primary}
        onPress={() => void action(() => closeShift(closing), 'ປິດກະສຳເລັດ')}
      >
        <Text style={styles.primaryText}>ປິດກະ</Text>
      </Pressable>
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: lightColors.background, padding: 22, gap: 9 },
  back: { color: lightColors.textMuted, fontSize: 13, marginBottom: 12 },
  title: { color: lightColors.text, fontFamily: 'NotoSansLao_700Bold', fontSize: 25 },
  note: {
    color: lightColors.textMuted,
    fontFamily: 'NotoSansLao_400Regular',
    fontSize: 12,
    marginBottom: 12,
  },
  label: { color: lightColors.text, fontFamily: 'NotoSansLao_700Bold', fontSize: 13, marginTop: 9 },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 12,
    backgroundColor: lightColors.surface,
    paddingHorizontal: 12,
    color: lightColors.text,
    fontFamily: 'NotoSansLao_400Regular',
  },
  primary: {
    minHeight: 46,
    backgroundColor: lightColors.primary,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: { color: lightColors.onPrimary, fontFamily: 'NotoSansLao_700Bold' },
  row: { flexDirection: 'row', gap: 9 },
  secondary: {
    flex: 1,
    minHeight: 44,
    backgroundColor: lightColors.soft,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: { color: lightColors.primary, fontFamily: 'NotoSansLao_700Bold' },
});
