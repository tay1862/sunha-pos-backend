import { Settings } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { ModulePlaceholder } from '../src/ui/module-placeholder';
import { lightColors } from '../src/design/tokens';
export default function SettingsScreen() {
  const router = useRouter();
  return (
    <ModulePlaceholder
      title="ຕັ້ງຄ່າ"
      description="ຕັ້ງຄ່າຮ້ານ ໃບເສັດ ພາສາ ແລະ ເຄື່ອງພິມ"
      icon={<Settings color={lightColors.primary} />}
      onBack={() => router.replace('/')}
    />
  );
}
