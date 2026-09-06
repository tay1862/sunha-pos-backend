import { ReceiptText } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ModulePlaceholder } from '../src/ui/module-placeholder';
import { lightColors } from '../src/design/tokens';
export default function ReceiptsScreen() {
  const router = useRouter();
  return (
    <ModulePlaceholder
      title="ໃບເສັດ"
      description="ຄົ້ນຫາ ແລະ ພິມໃບເສັດຍ້ອນຫຼັງ"
      icon={<ReceiptText color={lightColors.primary} />}
      onBack={() => router.replace('/')}
    />
  );
}
