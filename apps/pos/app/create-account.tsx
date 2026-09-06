import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FormButton, FormField, FormLink, FormScreen } from '../src/ui/form-screen';
import { signUp } from '../src/auth/auth-client';
import { ApiError } from '../src/api/client';

export default function CreateAccountScreen() {
  const router = useRouter();
  const [business, setBusiness] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await signUp({ businessName: business, email, password, country: 'LA' });
      router.push('/setup-store');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'ສ້າງບັນຊີບໍ່ສຳເລັດ');
    } finally {
      setLoading(false);
    }
  };
  return (
    <FormScreen
      title="ສ້າງບັນຊີ"
      subtitle="ເລີ່ມຕົ້ນຮ້ານຂອງທ່ານໃນເວລາບໍ່ດົນ"
      onBack={() => router.back()}
    >
      <FormField
        label="ຊື່ທຸລະກິດ"
        placeholder="ເຊັ່ນ ຮ້ານກາເຟ ສຸນຫາ"
        value={business}
        onChangeText={setBusiness}
      />
      <FormField
        label="ອີເມວເຈົ້າຂອງ"
        placeholder="you@example.com"
        value={email}
        onChangeText={setEmail}
      />
      <FormField
        label="ລະຫັດຜ່ານ"
        placeholder="ຢ່າງໜ້ອຍ 12 ຕົວອັກສອນ"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />
      {error ? <FormLink onPress={() => undefined}>⚠ {error}</FormLink> : null}
      <FormButton onPress={submit} disabled={loading} loading={loading}>
        ສ້າງບັນຊີ
      </FormButton>
    </FormScreen>
  );
}
