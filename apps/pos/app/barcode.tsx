import { CameraView, useCameraPermissions } from 'expo-camera';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Button, StyleSheet, Text, View } from 'react-native';

export default function BarcodeScreen() {
  const router = useRouter();
  const [permission, requestPermission] = useCameraPermissions();
  const [value, setValue] = useState('');
  if (!permission)
    return (
      <View style={styles.center}>
        <Text>ກຳລັງກວດສອບກ້ອງ…</Text>
      </View>
    );
  if (!permission.granted)
    return (
      <View style={styles.center}>
        <Text style={styles.text}>ຕ້ອງອະນຸຍາດກ້ອງເພື່ອສະແກນ Barcode</Text>
        <Button title="ອະນຸຍາດກ້ອງ" onPress={() => void requestPermission()} />
        <Button title="ກັບ" onPress={() => router.back()} />
      </View>
    );
  return (
    <View style={styles.safe}>
      <CameraView
        style={styles.camera}
        facing="back"
        barcodeScannerSettings={{
          barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128', 'code39', 'qr'],
        }}
        onBarcodeScanned={({ data }) => setValue(data)}
      />
      <View style={styles.result}>
        <Text style={styles.text}>{value ? `Barcode: ${value}` : 'ວາງ Barcode ໃນກອບ'}</Text>
        <Button title="ປິດ" onPress={() => router.back()} />
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f1720' },
  camera: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 },
  result: { padding: 20, gap: 12 },
  text: { color: '#fff', textAlign: 'center' },
});
