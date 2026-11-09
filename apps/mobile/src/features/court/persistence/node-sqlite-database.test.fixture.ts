import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import {
  createSqliteConnectionDatabase,
  type SqliteConnection,
} from "../../../adapters/sqlite-connection-database";
import type { SqlDatabase, SqlRow, SqlValue } from "../ports/sql-database";

/** Test-only: a real SQLite (the one built into Node) behind the port, with a fault injector. */
export interface NodeSqliteDatabase {
  readonly database: SqlDatabase;
  /** The nth `run` from now throws, as a disk error would. */
  failOnRun(nth: number): void;
  /** For assertions that read the file as it is, outside the port. */
  readonly raw: DatabaseSync;
}

function toSqlValue(value: SQLOutputValue): SqlValue {
  if (typeof value === "bigint") {
    return Number(value);
  }
  if (typeof value === "string" || typeof value === "number" || value === null) {
    return value;
  }
  throw new Error("column type the port does not carry");
}

function toRow(record: Readonly<Record<string, SQLOutputValue>>): SqlRow {
  return Object.fromEntries(Object.entries(record).map(([key, value]) => [key, toSqlValue(value)]));
}

export function openNodeSqliteDatabase(path = ":memory:"): NodeSqliteDatabase {
  const raw = new DatabaseSync(path);
  // A test file gains nothing from an fsync per commit, and it made the suite minutes long.
  raw.exec("PRAGMA foreign_keys = ON; PRAGMA synchronous = OFF");
  const fault = { value: null as number | null };

  function failIfDue(): void {
    if (fault.value === null) {
      return;
    }
    fault.value -= 1;
    if (fault.value === 0) {
      fault.value = null;
      throw new Error("injected disk failure");
    }
  }

  // The production wrapper over a connection, so the suite goes through its queue and its
  // BEGIN IMMEDIATE / COMMIT / ROLLBACK, with the fault injector under it.
  const connection: SqliteConnection = {
    execAsync: (sql) => {
      raw.exec(sql);
      return Promise.resolve();
    },
    runAsync: (sql, params) => {
      failIfDue();
      return Promise.resolve(raw.prepare(sql).run(...params));
    },
    getAllAsync: (sql, params) =>
      Promise.resolve(
        raw
          .prepare(sql)
          .all(...params)
          .map(toRow),
      ),
  };
  const database = createSqliteConnectionDatabase(connection);

  return {
    database,
    raw,
    failOnRun(nth) {
      fault.value = nth;
    },
  };
}
