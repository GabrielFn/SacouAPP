import { err, ok, type Result } from "@sacou/volley-rules";

import { HALTS_LIFTED_ON_OPEN } from "../ports/court-event-log";
import type { SqlDatabase, SqlExecutor } from "../ports/sql-database";
import { LIFT_HALTS_ON_OPEN } from "./court-queries.data";
import { MIGRATION_STEPS, USER_VERSION_PRAGMA } from "./migrations.data";

export type MigrationErrorCode = "storage-failed" | "unsupported-database-version";

export interface MigrationError {
  readonly code: MigrationErrorCode;
}

/** A schema version this app knows how to use: 0 (new file) up to the latest step. */
export function isKnownSchemaVersion(version: number): boolean {
  return version >= 0 && version <= MIGRATION_STEPS.length;
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
 * Brings the database to the latest schema, in one transaction, and lifts the halts a new start may
 * clear (ADR 0067, D4): it runs once per opening of the app. A database from a newer app is left
 * untouched: an old app must not write over a schema it does not know.
 */
export async function migrateDatabase(
  database: SqlDatabase,
): Promise<Result<void, MigrationError>> {
  try {
    return await database.transaction(async (transaction) => {
      const version = await readVersion(transaction);
      if (!isKnownSchemaVersion(version)) {
        return err({ code: "unsupported-database-version" as const });
      }
      await applySteps(transaction, version);
      await transaction.run(LIFT_HALTS_ON_OPEN, HALTS_LIFTED_ON_OPEN);
      return ok(undefined);
    });
  } catch {
    return err({ code: "storage-failed" });
  }
}
