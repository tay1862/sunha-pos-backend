import * as SQLite from 'expo-sqlite';

let database: SQLite.SQLiteDatabase | null = null;
async function getDatabase() {
  database ??= await SQLite.openDatabaseAsync('sunha-pos.db');
  await database.execAsync('CREATE TABLE IF NOT EXISTS catalog_cache (id INTEGER PRIMARY KEY, version TEXT NOT NULL, payload TEXT NOT NULL)');
  return database;
}

export async function saveCatalogSnapshot(version: string, payload: unknown) {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO catalog_cache (id, version, payload) VALUES (1, ?, ?)', version, JSON.stringify(payload));
}

export async function readCatalogSnapshot<T>() {
  const db = await getDatabase();
  const row = await db.getFirstAsync<{ version: string; payload: string }>('SELECT version, payload FROM catalog_cache WHERE id = 1');
  return row ? { version: row.version, payload: JSON.parse(row.payload) as T } : null;
}
