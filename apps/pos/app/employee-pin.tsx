import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FormButton, FormScreen } from '../src/ui/form-screen';
import { StyleSheet, Text, View } from 'react-native';

export default function EmployeePinScreen() {
  const router = useRouter();
  const [pin, setPin] = useState('');
  return (
    <FormScreen
      title="ໃສ່ PIN ພະນັກງານ"
      subtitle="ສຳລັບສະຫຼັບຜູ້ໃຊ້ໃນໜ້າຂາຍ"
      onBack={() => router.replace('/')}
    >
      <View style={styles.pinDots}>
        {[0, 1, 2, 3, 4, 5].map((index) => (
          <View key={index} style={[styles.dot, index < pin.length && styles.dotFilled]} />
        ))}
      </View>
      <Text style={styles.hint}>ຕົວຢ່າງ PIN 6 ຫຼັກ</Text>
      <FormButton disabled={pin.length !== 6} onPress={() => router.replace('/')}>
        ຢືນຢັນ
      </FormButton>
      <View style={styles.keypad}>
        {['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', ''].map((key) => (
          <Text
            key={key}
            onPress={() =>
              key === '⌫'
                ? setPin((value) => value.slice(0, -1))
                : key && pin.length < 6
                  ? setPin((value) => value + key)
                  : undefined
            }
            style={styles.key}
          >
            {key}
          </Text>
        ))}
      </View>
    </FormScreen>
  );
}

const styles = StyleSheet.create({
  pinDots: { flexDirection: 'row', justifyContent: 'center', gap: 12, paddingVertical: 18 },
  dot: { width: 13, height: 13, borderRadius: 7, borderWidth: 1, borderColor: '#B8C5C1' },
  dotFilled: { backgroundColor: '#087F8C', borderColor: '#087F8C' },
  hint: {
    textAlign: 'center',
    color: '#687974',
    fontFamily: 'NotoSansLao_400Regular',
    fontSize: 12,
  },
  keypad: {
    marginTop: 20,
    display: 'flex',
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 10,
  },
  key: {
    width: 76,
    height: 52,
    textAlign: 'center',
    textAlignVertical: 'center',
    borderRadius: 15,
    overflow: 'hidden',
    backgroundColor: '#E9F3F2',
    color: '#142522',
    fontFamily: 'NotoSansLao_700Bold',
    fontSize: 20,
    paddingTop: 12,
  },
});
