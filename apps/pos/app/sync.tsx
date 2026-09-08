import { useCallback, useEffect, useState } from 'react';
import {
  Alert,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowLeft, RefreshCw } from 'lucide-react-native';
import { listSyncOperations, retrySyncOperation } from '../src/auth/auth-client';
import { darkColors, lightColors } from '../src/design/tokens';

type Operation = Awaited<ReturnType<typeof listSyncOperations>>[number];
export default function SyncScreen() {
  const router = useRouter();
  const colors = useColorScheme() === 'dark' ? darkColors : lightColors;
  const [operations, setOperations] = useState<Operation[]>([]);
  const [loading, setLoading] = useState(false);
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setOperations(await listSyncOperations());
    } catch (error) {
      Alert.alert('Sync', error instanceof Error ? error.message : 'ໂຫຼດບໍ່ສຳເລັດ');
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  const retry = async (id: string) => {
    try {
      await retrySyncOperation(id);
      await load();
    } catch (error) {
      Alert.alert('Sync', error instanceof Error ? error.message : 'ກູ້ຄືນບໍ່ສຳເລັດ');
    }
  };
  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()}>
          <ArrowLeft color={colors.text} />
        </Pressable>
        <Text style={[styles.title, { color: colors.text }]}>Sync Center</Text>
        <Pressable onPress={load}>
          <RefreshCw color={colors.primary} />
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={styles.content}>
        {loading ? (
          <Text style={{ color: colors.textMuted }}>ກຳລັງໂຫຼດ...</Text>
        ) : operations.length === 0 ? (
          <Text style={{ color: colors.textMuted }}>ບໍ່ມີລາຍການ sync</Text>
        ) : (
          operations.map((op) => (
            <View
              key={op.operationId}
              style={[styles.row, { backgroundColor: colors.surface, borderColor: colors.border }]}
            >
              <View style={{ flex: 1 }}>
                <Text style={{ color: colors.text, fontWeight: '700' }}>{op.type}</Text>
                <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                  {op.operationId.slice(0, 8)} · {op.status} · attempts {op.attemptCount}
                </Text>
                {op.lastError ? (
                  <Text style={{ color: '#B42318', marginTop: 4 }}>{op.lastError}</Text>
                ) : null}
              </View>
              {op.status === 'FAILED_REVIEW' || op.status === 'PENDING' ? (
                <Pressable
                  onPress={() => retry(op.operationId)}
                  style={[styles.retry, { borderColor: colors.primary }]}
                >
                  <Text style={{ color: colors.primary }}>Retry</Text>
                </Pressable>
              ) : null}
            </View>
          ))
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
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 19, fontWeight: '700' },
  content: { padding: 16, gap: 10 },
  row: {
    minHeight: 76,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  retry: { borderWidth: 1, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 7 },
});
