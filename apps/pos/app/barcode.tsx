import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';
import { getCatalogSnapshot } from '../src/auth/auth-client';
import { lightColors } from '../src/design/tokens';

export default function BarcodeScreen() {
  const router = useRouter(); const colors = lightColors;
  const [permission, requestPermission] = useCameraPermissions(); const [value, setValue] = useState(''); const [matched, setMatched] = useState<string | null>(null); const [scanning, setScanning] = useState(true);
  useEffect(() => { if (!value) return; void getCatalogSnapshot().then((snapshot) => { const found = snapshot.items.find((item) => item.units.some((unit) => unit.barcode === value || unit.sku === value)); setMatched(found ? found.name : null); }).catch(() => setMatched(null)); }, [value]);
  if (!permission) return <View style={styles.center}><Text>ກຳລັງກວດສອບກ້ອງ…</Text></View>;
  if (!permission.granted) return <View style={styles.center}><Text style={styles.darkText}>ຕ້ອງອະນຸຍາດກ້ອງເພື່ອສະແກນ Barcode</Text><Button title="ອະນຸຍາດກ້ອງ" onPress={() => void requestPermission()} /><Button title="ກັບ" onPress={() => router.back()} /></View>;
  return <View style={styles.safe}><CameraView style={styles.camera} facing="back" barcodeScannerSettings={{ barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'] }} onBarcodeScanned={scanning ? ({ data }) => { setScanning(false); setValue(data); } : undefined} /><View style={styles.result}><Text style={styles.darkText}>{value ? `Barcode/SKU: ${value}` : 'ວາງ Barcode ໃນກອບ'}</Text>{value ? <Text style={[styles.darkText, { color: matched ? colors.success : colors.warning }]}>{matched ? `ພົບສິນຄ້າ: ${matched}` : 'ບໍ່ພົບ Barcode/SKU ນີ້'}</Text> : null}{value && !matched ? <Text style={styles.hint}>ກວດສອບວ່າສິນຄ້າຖືກບັນທຶກ Barcode ແລ້ວບໍ່</Text> : null}<Button title="ສະແກນອີກຄັ້ງ" onPress={() => { setValue(''); setMatched(null); setScanning(true); }} /><Button title="ປິດ" onPress={() => router.back()} /></View></View>;
}
const styles = StyleSheet.create({ safe: { flex: 1, backgroundColor: '#0f1720' }, camera: { flex: 1 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24, backgroundColor: lightColors.background }, result: { padding: 20, gap: 12, backgroundColor: '#0f1720' }, darkText: { color: '#fff', textAlign: 'center' }, hint: { color: '#ffd7a8', textAlign: 'center', fontSize: 12 } });
