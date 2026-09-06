import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  useColorScheme,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, Printer } from 'lucide-react-native';
import { darkColors, lightColors } from '../src/design/tokens';
import {
  listPrinterProfiles,
  printTest,
  savePrinterProfile,
  type PrinterProfile,
} from '../src/hardware/printer';

export default function PrintersScreen() {
  const router = useRouter();
  const colors = useColorScheme() === 'dark' ? darkColors : lightColors;
  const [profiles, setProfiles] = useState<PrinterProfile[]>([]);
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [transport, setTransport] = useState<'BLUETOOTH' | 'LAN'>('BLUETOOTH');
  const [paperWidth, setPaperWidth] = useState<58 | 80>(58);
  const [autoPrint, setAutoPrint] = useState(true);
  const load = useCallback(() => {
    void listPrinterProfiles()
      .then(setProfiles)
      .catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  const save = async () => {
    if (!name.trim() || !address.trim()) {
      Alert.alert('ຂໍ້ມູນບໍ່ຄົບ', 'ກະລຸນາໃສ່ຊື່ ແລະ ທີ່ຢູ່ Printer');
      return;
    }
    await savePrinterProfile({
      id: `${Date.now()}`,
      name: name.trim(),
      address: address.trim(),
      transport,
      paperWidth,
      autoPrint,
    });
    setName('');
    setAddress('');
    load();
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable accessibilityLabel="ກັບຄືນ" onPress={() => router.back()}>
          <ArrowLeft color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>ເຄື່ອງພິມ</Text>
        <Printer color={colors.primary} />
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.section, { color: colors.text }]}>ເພີ່ມ Printer</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="ຊື່ເຄື່ອງ"
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        />
        <TextInput
          value={address}
          onChangeText={setAddress}
          placeholder={
            transport === 'BLUETOOTH'
              ? 'Bluetooth MAC ເຊັ່ນ 00:11:22:33:44:55'
              : 'IP:Port ເຊັ່ນ 192.168.1.50:9100'
          }
          placeholderTextColor={colors.textMuted}
          style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          autoCapitalize="none"
        />
        <View style={styles.row}>
          {(['BLUETOOTH', 'LAN'] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setTransport(value)}
              style={[
                styles.choice,
                { borderColor: transport === value ? colors.primary : colors.border },
              ]}
            >
              <Text style={{ color: colors.text }}>{value}</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.row}>
          {([58, 80] as const).map((value) => (
            <Pressable
              key={value}
              accessibilityRole="button"
              onPress={() => setPaperWidth(value)}
              style={[
                styles.choice,
                { borderColor: paperWidth === value ? colors.primary : colors.border },
              ]}
            >
              <Text style={{ color: colors.text }}>{value}mm</Text>
            </Pressable>
          ))}
        </View>
        <View style={styles.autoRow}>
          <Text style={{ color: colors.text }}>ພິມອັດຕະໂນມັດຫຼັງຮັບເງິນ</Text>
          <Switch value={autoPrint} onValueChange={setAutoPrint} />
        </View>
        <Pressable
          style={[styles.button, { backgroundColor: colors.primary }]}
          onPress={() => void save()}
        >
          <Text style={{ color: colors.onPrimary }}>ບັນທຶກ</Text>
        </Pressable>
        <Text style={[styles.section, { color: colors.text }]}>Printer ທີ່ບັນທຶກ</Text>
        {profiles.length ? (
          profiles.map((profile) => (
            <View
              key={profile.id}
              style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{profile.name}</Text>
                <Text style={{ color: colors.textMuted }}>
                  {profile.transport} · {profile.address} · {profile.paperWidth}mm ·{' '}
                  {profile.autoPrint ? 'Auto' : 'Manual'}
                </Text>
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={() =>
                  void printTest(profile)
                    .then(() => Alert.alert('ສຳເລັດ', 'ພິມ test ແລ້ວ'))
                    .catch((error) =>
                      Alert.alert(
                        'ພິມບໍ່ສຳເລັດ',
                        error instanceof Error ? error.message : 'ກວດສອບ Printer',
                      ),
                    )
                }
              >
                <Text style={{ color: colors.primary }}>Test</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={{ color: colors.textMuted }}>
            ຍັງບໍ່ມີ Printer — ເພີ່ມ Printer ເພື່ອເລີ່ມພິມ
          </Text>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    height: 56,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 19, fontWeight: '700' },
  content: { padding: 16, gap: 12 },
  section: { fontSize: 17, fontWeight: '700', marginTop: 8 },
  input: { height: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  row: { flexDirection: 'row', gap: 8 },
  choice: { borderWidth: 1, borderRadius: 10, padding: 11, flex: 1, alignItems: 'center' },
  autoRow: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  button: { height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  card: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
});
