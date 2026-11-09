import { DatabaseSync, type SQLOutputValue } from "node:sqlite";

import type { SqlDatabase, SqlExecutor, SqlRow, SqlValue } from "../ports/sql-database";

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
  raw.exec("PRAGMA foreign_keys = ON");
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

  const executor: SqlExecutor = {
    exec: (sql) => {
      raw.exec(sql);
      return Promise.resolve();
    },
    run: (sql, params = []) => {
      failIfDue();
      raw.prepare(sql).run(...params);
      return Promise.resolve();
    },
    getAll: (sql, params = []) =>
      Promise.resolve(
        raw
          .prepare(sql)
          .all(...params)
          .map(toRow),
      ),
  };

  const database: SqlDatabase = {
    ...executor,
    async transaction(work) {
      raw.exec("BEGIN IMMEDIATE");
      try {
        const result = await work(executor);
        raw.exec("COMMIT");
        return result;
      } catch (error) {
        raw.exec("ROLLBACK");
        throw error;
      }
    },
  };

  return {
    database,
    raw,
    failOnRun(nth) {
      fault.value = nth;
    },
  };
}
