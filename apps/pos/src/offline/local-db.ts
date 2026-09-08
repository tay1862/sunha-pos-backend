import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';

const DB_NAME = 'sunha-pos.db';
const KEY_NAME = 'sunha.local-db-key';
let database: SQLite.SQLiteDatabase | null = null;
let initialized: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  initialized ??= initialize();
  return initialized;
}

export async function saveLocalCart(cart: Record<string, number>) {
  const db = await getLocalDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO local_cart (id, payload, updated_at) VALUES (1, ?, ?)',
    JSON.stringify(cart),
    new Date().toISOString(),
  );
}
export async function readLocalCart(): Promise<Record<string, number>> {
  const db = await getLocalDatabase();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM local_cart WHERE id = 1',
  );
  return row ? (JSON.parse(row.payload) as Record<string, number>) : {};
}

async function initialize() {
  database = await SQLite.openDatabaseAsync(DB_NAME);
  await database.execAsync('PRAGMA foreign_keys = ON;');
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS schema_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS catalog_cache (id INTEGER PRIMARY KEY, version TEXT NOT NULL, payload TEXT NOT NULL);',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS local_cart (id TEXT PRIMARY KEY NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS outbox (operation_id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, occurred_at TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, next_retry_at TEXT, error TEXT, depends_on TEXT);',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
  );
  await database.execAsync("UPDATE outbox SET status = 'PENDING' WHERE status = 'SYNCING'");
  await database.runAsync(
    "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', '2')",
  );
  // SecureStore/Android Keystore is provisioned for the local database. Stock Expo SQLite
  // does not expose SQLCipher pragmas; production native builds must enable SQLCipher.
  if (!(await SecureStore.getItemAsync(KEY_NAME)))
    await SecureStore.setItemAsync(KEY_NAME, randomKey());
  return database;
}

function randomKey() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}
