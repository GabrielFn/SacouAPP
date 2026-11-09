import { err, ok, type Result } from "@sacou/volley-rules";

import type { SqlDatabase, SqlExecutor } from "../ports/sql-database";
import { MIGRATION_STEPS, USER_VERSION_PRAGMA } from "./migrations.data";

export type MigrationErrorCode = "storage-failed" | "unsupported-database-version";

export interface MigrationError {
  readonly code: MigrationErrorCode;
}

async function readVersion(executor: SqlExecutor): Promise<number> {
  const [row] = await executor.getAll(`PRAGMA ${USER_VERSION_PRAGMA}`);
  const version = row?.[USER_VERSION_PRAGMA];
  if (typeof version !== "number") {
    throw new Error("user_version is not a number");
  }
  return version;
}

async function applySteps(transaction: SqlExecutor, from: number): Promise<void> {
  const pending = MIGRATION_STEPS.slice(from);
  for (const [offset, step] of pending.entries()) {
    await transaction.exec(step);
    await transaction.exec(`PRAGMA ${USER_VERSION_PRAGMA} = ${String(from + offset + 1)}`);
  }
}

/**
 * Brings the database to the latest schema, in one transaction. A database from a newer app is
 * left untouched: an old app must not write over a schema it does not know.
 */
export async function migrateDatabase(database: SqlDatabase): Promise<Result<void, MigrationError>> {
  try {
    return await database.transaction(async (transaction) => {
      const version = await readVersion(transaction);
      if (version > MIGRATION_STEPS.length) {
        return err({ code: "unsupported-database-version" as const });
      }
      await applySteps(transaction, version);
      return ok(undefined);
    });
  } catch {
    return err({ code: "storage-failed" });
  }
}
