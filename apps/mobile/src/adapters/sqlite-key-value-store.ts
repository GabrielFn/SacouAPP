import type { SqlDatabase } from "../features/court/ports/sql-database";
import type { KeyValueStore } from "../services/query/key-value-store";

/** The server cache's own file, never the court's `sacou.db`, which keeps no names (ADR 0038, E4.2 D6). */
export const CACHE_DATABASE_FILE = "sacou-cache.db";

const SCHEMA_VERSION = 1;
const USER_VERSION = "user_version";
// A cache can always be rebuilt from the API: an unknown version (an older or newer app) starts empty.
const RESET_SCHEMA = [
  "DROP TABLE IF EXISTS kv;",
  "CREATE TABLE kv (key TEXT PRIMARY KEY, value TEXT NOT NULL) STRICT;",
  `PRAGMA ${USER_VERSION} = ${String(SCHEMA_VERSION)};`,
].join("\n");

export async function migrateCacheDatabase(database: SqlDatabase): Promise<void> {
  const [row] = await database.getAll(`PRAGMA ${USER_VERSION}`);
  if (row?.[USER_VERSION] !== SCHEMA_VERSION) await database.exec(RESET_SCHEMA);
}

const UPSERT =
  "INSERT INTO kv (key, value) VALUES (?, ?) ON CONFLICT (key) DO UPDATE SET value = excluded.value";

/** The `KeyValueStore` over a migrated cache database. Values are parameters, never SQL text. */
export function createSqliteKeyValueStore(database: SqlDatabase): KeyValueStore {
  return {
    async getItem(key) {
      const [row] = await database.getAll("SELECT value FROM kv WHERE key = ?", [key]);
      const value = row?.value;
      return typeof value === "string" ? value : null;
    },
    setItem: (key, value) => database.run(UPSERT, [key, value]),
    removeItem: (key) => database.run("DELETE FROM kv WHERE key = ?", [key]),
  };
}
