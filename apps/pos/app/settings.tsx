import { useCallback, useEffect, useState } from 'react';
import { Alert, View } from 'react-native';
import { useRouter } from 'expo-router';
import { FormButton, FormField, FormScreen } from '../src/ui/form-screen';
import { getStoreSettings, logout, updateStoreSettings } from '../src/auth/auth-client';

export default function SettingsScreen() {
  const router = useRouter();
  const [name, setName] = useState(''); const [address, setAddress] = useState('');
  const [phone, setPhone] = useState(''); const [taxNumber, setTaxNumber] = useState('');
  const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  const load = useCallback(async () => { try { const store = await getStoreSettings(); setName(store.name); setAddress(store.address); setPhone(store.phone); setTaxNumber(store.taxNumber); } catch (error) { Alert.alert('ຕັ້ງຄ່າ', error instanceof Error ? error.message : 'ໂຫຼດບໍ່ສຳເລັດ'); } finally { setLoading(false); } }, []);
  useEffect(() => { void load(); }, [load]);
  const save = async () => { if (!name.trim()) { Alert.alert('ຕັ້ງຄ່າ', 'ກະລຸນາໃສ່ຊື່ຮ້ານ'); return; } setSaving(true); try { await updateStoreSettings({ name: name.trim(), address, phone, taxNumber }); Alert.alert('ສຳເລັດ', 'ບັນທຶກຂໍ້ມູນຮ້ານແລ້ວ'); } catch (error) { Alert.alert('ຕັ້ງຄ່າ', error instanceof Error ? error.message : 'ບັນທຶກບໍ່ສຳເລັດ'); } finally { setSaving(false); } };
  const signOut = async () => { await logout(); router.replace('/login'); };
  return <FormScreen title="ຕັ້ງຄ່າຮ້ານ" subtitle="ຂໍ້ມູນຮ້ານຈະສະແດງໃນໃບເສັດ" onBack={() => router.replace('/')}><View style={{ gap: 12 }}><FormField label="ຊື່ຮ້ານ" value={name} onChangeText={setName} editable={!loading} /><FormField label="ທີ່ຢູ່" value={address} onChangeText={setAddress} editable={!loading} /><FormField label="ເບີໂທ" value={phone} onChangeText={setPhone} keyboardType="phone-pad" editable={!loading} /><FormField label="ເລກປະຈຳຕົວຜູ້ເສຍພາສີ" value={taxNumber} onChangeText={setTaxNumber} editable={!loading} /><FormField label="ສະກຸນເງິນ" value="LAK · ກີບລາວ" onChangeText={() => undefined} editable={false} /><FormButton onPress={save} disabled={loading || saving} loading={saving}>ບັນທຶກ</FormButton><FormButton onPress={signOut} disabled={saving}>ອອກຈາກລະບົບ</FormButton></View></FormScreen>;
}
