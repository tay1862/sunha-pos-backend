import { getLocalDatabase } from './local-db';
import { getSessionContext } from '../auth/token-storage';

async function scope() {
  const context = await getSessionContext();
  if (!context.tenantId || !context.storeId) throw new Error('STORE_CONTEXT_REQUIRED');
  return `${context.tenantId}:${context.storeId}`;
}

export async function saveCatalogSnapshot(version: string, payload: unknown) {
  const db = await getLocalDatabase();
  const key = await scope();
  await db.runAsync(
    'INSERT OR REPLACE INTO scoped_catalog_cache (scope, version, payload) VALUES (?, ?, ?)',
    key,
    version,
    JSON.stringify(payload),
  );
}

export async function readCatalogSnapshot<T>() {
  const db = await getLocalDatabase();
  const key = await scope();
  const row = await db.getFirstAsync<{ version: string; payload: string }>(
    'SELECT version, payload FROM scoped_catalog_cache WHERE scope = ?',
    key,
  );
  return row ? { version: row.version, payload: JSON.parse(row.payload) as T } : null;
}
