import { describe, expect, test } from "vitest";

import type { SqlRow, SqlValue } from "../features/court/ports/sql-database";
import {
  createSqliteConnectionDatabase,
  type SqliteConnection,
} from "./sqlite-connection-database";

/** Records what reaches the connection and lets a test hold or fail a statement. */
function fakeConnection(options: { failOn?: string; hold?: Promise<void> } = {}) {
  const calls: string[] = [];
  const connection: SqliteConnection = {
    async execAsync(sql) {
      calls.push(sql);
      if (sql === options.failOn) throw new Error("boom");
      if (sql === "BEGIN IMMEDIATE" && options.hold) await options.hold;
    },
    runAsync: async (sql: string, params: SqlValue[]) => {
      calls.push(`run ${sql} ${JSON.stringify(params)}`);
      await Promise.resolve();
    },
    getAllAsync: async (sql: string): Promise<SqlRow[]> => {
      calls.push(`get ${sql}`);
      return Promise.resolve([]);
    },
  };
  return { calls, connection };
}

async function failing(): Promise<never> {
  await Promise.resolve();
  throw new Error("work failed");
}

describe("createSqliteConnectionDatabase", () => {
  test("a transaction is BEGIN IMMEDIATE, the work and COMMIT", async () => {
    const { calls, connection } = fakeConnection();
    const database = createSqliteConnectionDatabase(connection);

    const result = await database.transaction(async (tx) => {
      await tx.run("INSERT", [1]);
      return "done";
    });

    expect(result).toBe("done");
    expect(calls).toEqual(["BEGIN IMMEDIATE", "run INSERT [1]", "COMMIT"]);
  });

  test("an error in the work rolls back, never commits, and is rethrown", async () => {
    const { calls, connection } = fakeConnection();
    const database = createSqliteConnectionDatabase(connection);

    await expect(database.transaction(failing)).rejects.toThrow("work failed");

    expect(calls).toEqual(["BEGIN IMMEDIATE", "ROLLBACK"]);
  });

  test("a failing ROLLBACK does not hide the error of the work", async () => {
    const { connection } = fakeConnection({ failOn: "ROLLBACK" });
    const database = createSqliteConnectionDatabase(connection);

    await expect(database.transaction(failing)).rejects.toThrow("work failed");
  });

  test("a failing COMMIT rolls back", async () => {
    const { calls, connection } = fakeConnection({ failOn: "COMMIT" });
    const database = createSqliteConnectionDatabase(connection);

    await expect(database.transaction(() => Promise.resolve(1))).rejects.toThrow("boom");

    expect(calls).toEqual(["BEGIN IMMEDIATE", "COMMIT", "ROLLBACK"]);
  });

  test("calls queue behind a transaction and never run inside it", async () => {
    const release = { open: (): void => undefined };
    const hold = new Promise<void>((resolve) => {
      release.open = resolve;
    });
    const { calls, connection } = fakeConnection({ hold });
    const database = createSqliteConnectionDatabase(connection);

    const first = database.transaction(async (tx) => {
      await tx.run("A", []);
    });
    const second = database.transaction(async (tx) => {
      await tx.run("B", []);
    });
    const loose = database.run("C", []);
    await Promise.resolve();
    expect(calls).toEqual(["BEGIN IMMEDIATE"]);
    release.open();
    await Promise.all([first, second, loose]);

    expect(calls).toEqual([
      "BEGIN IMMEDIATE",
      "run A []",
      "COMMIT",
      "BEGIN IMMEDIATE",
      "run B []",
      "COMMIT",
      "run C []",
    ]);
  });

  test("a failed transaction does not block the next one", async () => {
    const { calls, connection } = fakeConnection();
    const database = createSqliteConnectionDatabase(connection);
    await database.transaction(failing).catch(() => undefined);

    await database.transaction(() => Promise.resolve());

    expect(calls.slice(-2)).toEqual(["BEGIN IMMEDIATE", "COMMIT"]);
  });
});
