import { getLocalDatabase } from './local-db';

export async function saveCatalogSnapshot(version: string, payload: unknown) {
  const db = await getLocalDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO catalog_cache (id, version, payload) VALUES (1, ?, ?)',
    version,
    JSON.stringify(payload),
  );
}

export async function readCatalogSnapshot<T>() {
  const db = await getLocalDatabase();
  const row = await db.getFirstAsync<{ version: string; payload: string }>(
    'SELECT version, payload FROM catalog_cache WHERE id = 1',
  );
  return row ? { version: row.version, payload: JSON.parse(row.payload) as T } : null;
}
