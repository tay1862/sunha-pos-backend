import * as SQLite from 'expo-sqlite';
import * as SecureStore from 'expo-secure-store';
import { getSessionContext } from '../auth/token-storage';

const DB_NAME = 'sunha-pos.db';
const KEY_NAME = 'sunha.local-db-key';
let database: SQLite.SQLiteDatabase | null = null;
let initialized: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getLocalDatabase(): Promise<SQLite.SQLiteDatabase> {
  initialized ??= initialize().catch((error: unknown) => {
    initialized = null;
    throw error;
  });
  return initialized;
}

export async function saveLocalCart(cart: Record<string, number>) {
  const db = await getLocalDatabase();
  const context = await getSessionContext();
  await db.runAsync(
    'INSERT OR REPLACE INTO scoped_local_cart (id, tenant_id, store_id, payload, updated_at) VALUES (?, ?, ?, ?, ?)',
    `${context.tenantId ?? 'unknown'}:${context.storeId ?? 'unknown'}`,
    context.tenantId ?? 'unknown',
    context.storeId ?? 'unknown',
    JSON.stringify(cart),
    new Date().toISOString(),
  );
}
export async function readLocalCart(): Promise<Record<string, number>> {
  const db = await getLocalDatabase();
  const context = await getSessionContext();
  const row = await db.getFirstAsync<{ payload: string }>(
    'SELECT payload FROM scoped_local_cart WHERE tenant_id = ? AND store_id = ? ORDER BY updated_at DESC LIMIT 1',
    context.tenantId ?? 'unknown',
    context.storeId ?? 'unknown',
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
    'CREATE TABLE IF NOT EXISTS local_cart (id TEXT PRIMARY KEY NOT NULL, tenant_id TEXT, store_id TEXT, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS outbox (operation_id TEXT PRIMARY KEY NOT NULL, type TEXT NOT NULL, payload TEXT NOT NULL, occurred_at TEXT NOT NULL, status TEXT NOT NULL, created_at TEXT NOT NULL, attempt_count INTEGER NOT NULL DEFAULT 0, next_retry_at INTEGER, syncing_until INTEGER, error TEXT, depends_on TEXT);',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS sync_meta (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS scoped_catalog_cache (scope TEXT PRIMARY KEY NOT NULL, version TEXT NOT NULL, payload TEXT NOT NULL);',
  );
  await database.execAsync(
    'CREATE TABLE IF NOT EXISTS scoped_local_cart (id TEXT PRIMARY KEY NOT NULL, tenant_id TEXT NOT NULL, store_id TEXT NOT NULL, payload TEXT NOT NULL, updated_at TEXT NOT NULL);',
  );
  await database.withTransactionAsync(async () => {
    for (const statement of [
      'ALTER TABLE outbox ADD COLUMN syncing_until INTEGER',
      'ALTER TABLE outbox ADD COLUMN next_retry_epoch INTEGER',
      'ALTER TABLE outbox ADD COLUMN tenant_id TEXT',
      'ALTER TABLE outbox ADD COLUMN store_id TEXT',
      'ALTER TABLE outbox ADD COLUMN device_id TEXT',
      'ALTER TABLE local_cart ADD COLUMN tenant_id TEXT',
      'ALTER TABLE local_cart ADD COLUMN store_id TEXT',
    ]) {
      try {
        await database?.execAsync(statement);
      } catch (error) {
        if (!(error instanceof Error) || !error.message.includes('duplicate column name'))
          throw error;
      }
    }
    await database?.execAsync(
      "UPDATE outbox SET next_retry_epoch = CAST(strftime('%s', next_retry_at) AS INTEGER) * 1000 WHERE next_retry_epoch IS NULL AND next_retry_at IS NOT NULL",
    );
    await database?.execAsync(
      "UPDATE outbox SET status = 'PENDING', syncing_until = NULL WHERE status = 'SYNCING' AND (syncing_until IS NULL OR syncing_until < CAST(strftime('%s','now') AS INTEGER) * 1000)",
    );
    const version = await database?.getFirstAsync<{ value: string }>(
      "SELECT value FROM schema_meta WHERE key = 'version'",
    );
    if (Number(version?.value ?? '0') < 5) {
      await database?.execAsync(
        "INSERT OR IGNORE INTO scoped_local_cart (id, tenant_id, store_id, payload, updated_at) SELECT tenant_id || ':' || store_id, tenant_id, store_id, payload, updated_at FROM local_cart WHERE tenant_id IS NOT NULL AND store_id IS NOT NULL",
      );
    }
    await database?.runAsync(
      "INSERT OR REPLACE INTO schema_meta (key, value) VALUES ('version', '5')",
    );
  });
  // SecureStore/Android Keystore is provisioned for the local database. Stock Expo SQLite
  // does not expose SQLCipher pragmas; production native builds must enable SQLCipher.
  if (!(await SecureStore.getItemAsync(KEY_NAME)))
    await SecureStore.setItemAsync(KEY_NAME, randomKey());
  return database;
}

function randomKey() {
  const bytes = new Uint8Array(32);
  globalThis.crypto?.getRandomValues(bytes);
  return Array.from(bytes, (value) => value.toString(16).padStart(2, '0')).join('');
}
