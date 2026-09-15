import { NativeModules, PermissionsAndroid, Platform } from 'react-native';
import { getLocalDatabase } from '../offline/local-db';
import { validatePrinterProfile, type PrinterProfile } from './printer-profile';

export type { PrinterProfile } from './printer-profile';
type NativePrinter = {
  connect(profile: PrinterProfile): Promise<void>;
  disconnect(): Promise<void>;
  printReceipt(text: string): Promise<void>;
  printTest(): Promise<void>;
};
const nativePrinter = NativeModules.SunhaPrinter as NativePrinter | undefined;
async function ensureBluetoothPermission(transport: PrinterProfile['transport']) {
  if (transport !== 'BLUETOOTH' || Platform.OS !== 'android' || Number(Platform.Version) < 31)
    return;
  const result = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT);
  if (result !== PermissionsAndroid.RESULTS.GRANTED)
    throw new Error('BLUETOOTH_PERMISSION_REQUIRED');
}

export async function savePrinterProfile(profile: PrinterProfile) {
  validatePrinterProfile(profile);
  const db = await getLocalDatabase();
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS printer_profiles (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)',
  );
  await db.runAsync(
    'INSERT OR REPLACE INTO printer_profiles (id, payload, updated_at) VALUES (?, ?, ?)',
    profile.id,
    JSON.stringify(profile),
    new Date().toISOString(),
  );
  if (profile.autoPrint) {
    const rows = await db.getAllAsync<{ id: string; payload: string }>('SELECT id, payload FROM printer_profiles');
    for (const row of rows) {
      const existing = JSON.parse(row.payload) as PrinterProfile;
      if (existing.id !== profile.id && existing.autoPrint) {
        existing.autoPrint = false;
        await db.runAsync('UPDATE printer_profiles SET payload=?, updated_at=? WHERE id=?', JSON.stringify(existing), new Date().toISOString(), existing.id);
      }
    }
  }
}
async function ensurePrintJobs() {
  const db = await getLocalDatabase();
  await db.execAsync('CREATE TABLE IF NOT EXISTS print_jobs (id TEXT PRIMARY KEY NOT NULL, printer_id TEXT NOT NULL, payload TEXT NOT NULL, status TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL)');
  return db;
}
export async function listPrinterProfiles(): Promise<PrinterProfile[]> {
  const db = await getLocalDatabase();
  await db.execAsync(
    'CREATE TABLE IF NOT EXISTS printer_profiles (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL)',
  );
  const rows = await db.getAllAsync<{ payload: string }>(
    'SELECT payload FROM printer_profiles ORDER BY updated_at DESC',
  );
  return rows.map((row) => JSON.parse(row.payload) as PrinterProfile);
}
export async function printReceipt(profile: PrinterProfile, text: string) {
  if (Platform.OS !== 'android' || !nativePrinter)
    throw new Error('PRINTER_NATIVE_MODULE_NOT_AVAILABLE');
  const db = await ensurePrintJobs();
  const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const now = new Date().toISOString();
  await db.runAsync('INSERT INTO print_jobs (id, printer_id, payload, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', id, profile.id, text, 'QUEUED', now, now);
  try {
    await db.runAsync("UPDATE print_jobs SET status='PRINTING', attempts=attempts+1, updated_at=? WHERE id=?", new Date().toISOString(), id);
    await ensureBluetoothPermission(profile.transport);
    await nativePrinter.connect(profile);
    await nativePrinter.printReceipt(text);
    await db.runAsync("UPDATE print_jobs SET status='PRINTED', updated_at=? WHERE id=?", new Date().toISOString(), id);
  } catch (error) {
    await db.runAsync("UPDATE print_jobs SET status='FAILED', error=?, updated_at=? WHERE id=?", error instanceof Error ? error.message : 'PRINT_FAILED', new Date().toISOString(), id);
    throw error;
  }
}

export async function listPrintJobs() {
  const db = await ensurePrintJobs();
  return db.getAllAsync<{ id: string; printer_id: string; status: string; attempts: number; error: string | null; created_at: string }>('SELECT id, printer_id, status, attempts, error, created_at FROM print_jobs ORDER BY created_at DESC');
}
export async function printTest(profile: PrinterProfile) {
  if (Platform.OS !== 'android' || !nativePrinter)
    throw new Error('PRINTER_NATIVE_MODULE_NOT_AVAILABLE');
  await ensureBluetoothPermission(profile.transport);
  await nativePrinter.connect(profile);
  await nativePrinter.printTest();
}
