import { useState } from 'react';
import { useRouter } from 'expo-router';
import { FormButton, FormField, FormLink, FormScreen } from '../src/ui/form-screen';
import { login } from '../src/auth/auth-client';
import { ApiError } from '../src/api/client';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await login({ email, password });
      router.replace('/');
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : 'ເກີດຂໍ້ຜິດພາດ');
    } finally {
      setLoading(false);
    }
  };
  return (
    <FormScreen
      title="ເຂົ້າສູ່ Sunha"
      subtitle="ໃຊ້ບັນຊີເຈົ້າຂອງເພື່ອຈັດການຮ້ານ"
      onBack={() => router.replace('/')}
    >
      <FormField
        label="ອີເມວ"
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
        ເຂົ້າສູ່ລະບົບ
      </FormButton>
      <FormLink onPress={() => router.push('/create-account')}>ສ້າງຮ້ານໃໝ່</FormLink>
      <FormLink onPress={() => undefined}>ລືມລະຫັດຜ່ານ?</FormLink>
    </FormScreen>
  );
}
