import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FormButton, FormField, FormLink, FormScreen } from '../src/ui/form-screen';
import { updateStoreSettings } from '../src/auth/auth-client';

export default function SetupStoreScreen() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await updateStoreSettings({ name, address });
      router.replace('/');
    } catch {
      setError('ບັນທຶກຮ້ານບໍ່ສຳເລັດ');
    } finally {
      setLoading(false);
    }
  };
  return (
    <FormScreen
      title="ຕັ້ງຄ່າຮ້ານ"
      subtitle="ຂໍ້ມູນນີ້ຈະສະແດງໃນໃບເສັດ"
      onBack={() => router.back()}
    >
      <FormField label="ຊື່ຮ້ານ" placeholder="ຊື່ຮ້ານຂອງທ່ານ" value={name} onChangeText={setName} />
      <FormField
        label="ທີ່ຢູ່"
        placeholder="ບ້ານ, ເມືອງ, ແຂວງ"
        value={address}
        onChangeText={setAddress}
      />
      <FormField label="ສະກຸນເງິນ" value="LAK · ກີບລາວ" onChangeText={() => undefined} />
      {error ? <FormLink onPress={() => undefined}>⚠ {error}</FormLink> : null}
      <FormButton onPress={submit} disabled={loading} loading={loading}>
        ເຂົ້າສູ່ໜ້າຂາຍ
      </FormButton>
    </FormScreen>
  );
}
