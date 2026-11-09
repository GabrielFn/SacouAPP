import { openDatabaseAsync } from "expo-sqlite";

import { isKnownSchemaVersion } from "../features/court/persistence/migrations";
import { USER_VERSION_PRAGMA } from "../features/court/persistence/migrations.data";
import type { SqlDatabase } from "../features/court/ports/sql-database";
import { createSqliteConnectionDatabase } from "./sqlite-connection-database";

/** Durable also if the phone powers off, and the foreign keys of the court log enforced. */
const CONNECTION_PRAGMAS = "PRAGMA synchronous = FULL; PRAGMA foreign_keys = ON;";
/** Writes to the file, so it waits until the schema version is known to be one this app handles. */
const WAL_PRAGMA = "PRAGMA journal_mode = WAL;";

export async function openExpoSqliteDatabase(fileName: string): Promise<SqlDatabase> {
  const connection = await openDatabaseAsync(fileName);
  await connection.execAsync(CONNECTION_PRAGMAS);
  const row = await connection.getFirstAsync<Record<string, unknown>>(
    `PRAGMA ${USER_VERSION_PRAGMA}`,
  );
  const version = row?.[USER_VERSION_PRAGMA];
  if (typeof version === "number" && isKnownSchemaVersion(version)) {
    await connection.execAsync(WAL_PRAGMA);
  }
  return createSqliteConnectionDatabase(connection);
}
