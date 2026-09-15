import { useEffect, useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { createEmployee, listEmployees, updateEmployee } from '../src/auth/auth-client';
import { lightColors } from '../src/design/tokens';
export default function EmployeesScreen() {
  const [employees, setEmployees] = useState<Awaited<ReturnType<typeof listEmployees>>>([]);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const reload = () => listEmployees().then(setEmployees);
  useEffect(() => {
    void reload();
  }, []);
  const save = async () => {
    if ((pin && pin.length !== 6) || !name) return;
    if (editingId) await updateEmployee(editingId, { name, ...(pin ? { pin } : {}) });
    else await createEmployee({ name, pin, role: 'CASHIER' });
    setName('');
    setPin('');
    setEditingId(null);
    await reload();
  };
  return (
    <View style={styles.page}>
      <Text style={styles.title}>ພະນັກງານ</Text>
      <View style={styles.card}>
        <TextInput placeholder="ຊື່" value={name} onChangeText={setName} style={styles.input} />
        <TextInput
          placeholder={editingId ? 'PIN ໃໝ່ (ປ່ອຍວ່າງໄດ້)' : 'PIN 6 ຫຼັກ'}
          value={pin}
          onChangeText={setPin}
          keyboardType="number-pad"
          maxLength={6}
          style={styles.input}
        />
        <Text style={styles.button} onPress={() => void save()}>
          {editingId ? 'ອັບເດດພະນັກງານ' : '+ ເພີ່ມ Cashier'}
        </Text>
      </View>
      {employees.map((employee) => (
        <View style={styles.row} key={employee.id}>
          <Text style={styles.name}>{employee.name}</Text>
          <Text style={styles.meta}>
            {employee.role} · {employee.active ? 'ACTIVE' : 'INACTIVE'}
          </Text>
          <Text
            style={styles.link}
            onPress={() => {
              setEditingId(employee.id);
              setName(employee.name);
              setPin('');
            }}
          >
            ແກ້ໄຂ
          </Text>
          {employee.active ? (
            <Text
              style={styles.delete}
              onPress={() => void updateEmployee(employee.id, { active: false }).then(reload)}
            >
              ປິດໃຊ້ງານ
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}
const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: lightColors.background, padding: 22 },
  title: {
    fontSize: 25,
    fontFamily: 'NotoSansLao_700Bold',
    color: lightColors.text,
    marginBottom: 18,
  },
  card: {
    backgroundColor: lightColors.surface,
    borderRadius: 14,
    padding: 14,
    gap: 8,
    marginBottom: 14,
  },
  input: {
    borderWidth: 1,
    borderColor: lightColors.border,
    borderRadius: 10,
    padding: 10,
    color: lightColors.text,
  },
  button: {
    backgroundColor: lightColors.primary,
    color: '#fff',
    textAlign: 'center',
    padding: 12,
    borderRadius: 10,
  },
  row: { padding: 14, backgroundColor: lightColors.surface, borderRadius: 12, marginBottom: 8 },
  name: { fontFamily: 'NotoSansLao_700Bold', color: lightColors.text },
  meta: { color: lightColors.textMuted },
  link: { color: lightColors.primary, marginTop: 8 },
  delete: { color: '#B42318', marginTop: 4 },
});
