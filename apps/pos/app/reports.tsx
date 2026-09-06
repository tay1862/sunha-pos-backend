import { BarChart3 } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ModulePlaceholder } from '../src/ui/module-placeholder';
import { lightColors } from '../src/design/tokens';
export default function ReportsScreen() {
  const router = useRouter();
  return (
    <ModulePlaceholder
      title="ລາຍງານ"
      description="ກວດເບິ່ງຍອດຂາຍ ກະ ແລະ ສິນຄ້າ"
      icon={<BarChart3 color={lightColors.primary} />}
      onBack={() => router.replace('/')}
    />
  );
}
