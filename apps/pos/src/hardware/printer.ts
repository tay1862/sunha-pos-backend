import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { getLocalDatabase } from '../offline/local-db';

export type PrinterProfile = { id: string; name: string; transport: 'BLUETOOTH' | 'LAN'; address: string; paperWidth: 58 | 80; autoPrint: boolean };
type NativePrinter = { connect(profile: PrinterProfile): Promise<void>; disconnect(): Promise<void>; printReceipt(text: string): Promise<void>; printTest(): Promise<void> };
const nativePrinter = NativeModules.SunhaPrinter as NativePrinter | undefined;
async function ensureBluetoothPermission(transport: PrinterProfile['transport']) {
  if (transport !== 'BLUETOOTH' || Platform.OS !== 'android' || Number(Platform.Version) < 31) return;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  if (result !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('BLUETOOTH_PERMISSION_REQUIRED');
}

export async function savePrinterProfile(profile: PrinterProfile) {
  const db = await getLocalDatabase();
  await db.execAsync('CREATE TABLE IF NOT EXISTS printer_profiles (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
  await db.runAsync('INSERT OR REPLACE INTO printer_profiles (id, payload, updated_at) VALUES (?, ?, ?)', profile.id, JSON.stringify(profile), new Date().toISOString());
}
export async function listPrinterProfiles(): Promise<PrinterProfile[]> {
  const db = await getLocalDatabase();
  await db.execAsync('CREATE TABLE IF NOT EXISTS printer_profiles (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)');
  const rows = await db.getAllAsync<{ payload: string }>('SELECT payload FROM printer_profiles ORDER BY updated_at DESC');
  return rows.map((row) => JSON.parse(row.payload) as PrinterProfile);
}
export async function printReceipt(profile: PrinterProfile, text: string) {
  if (Platform.OS !== 'android' || !nativePrinter) throw new Error('PRINTER_NATIVE_MODULE_NOT_AVAILABLE');
  await ensureBluetoothPermission(profile.transport);
  await nativePrinter.connect(profile); await nativePrinter.printReceipt(text);
}
export async function printTest(profile: PrinterProfile) {
  if (Platform.OS !== 'android' || !nativePrinter) throw new Error('PRINTER_NATIVE_MODULE_NOT_AVAILABLE');
  await ensureBluetoothPermission(profile.transport);
  await nativePrinter.connect(profile); await nativePrinter.printTest();
}
