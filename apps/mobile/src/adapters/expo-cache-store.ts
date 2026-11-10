import { openDatabaseAsync } from "expo-sqlite";

import type { KeyValueStore } from "../services/query/key-value-store";
import { createSqliteConnectionDatabase } from "./sqlite-connection-database";
import {
  CACHE_DATABASE_FILE,
  createSqliteKeyValueStore,
  migrateCacheDatabase,
} from "./sqlite-key-value-store";

/**
 * Opens `sacou-cache.db` on first use. When it cannot be opened the store is empty and silent: the app
 * works online without the cache, and the court never depends on it.
 */
export function createExpoCacheStore(): KeyValueStore {
  const opened: { current: Promise<KeyValueStore | null> | null } = { current: null };

  function open(): Promise<KeyValueStore | null> {
    opened.current ??= openDatabaseAsync(CACHE_DATABASE_FILE)
      .then(async (connection) => {
        const database = createSqliteConnectionDatabase(connection);
        await migrateCacheDatabase(database);
        return createSqliteKeyValueStore(database);
      })
      .catch(() => null);
    return opened.current;
  }

  return {
    getItem: async (key) => (await open())?.getItem(key) ?? null,
    setItem: async (key, value) => {
      await (await open())?.setItem(key, value);
    },
    removeItem: async (key) => {
      await (await open())?.removeItem(key);
    },
  };
}
