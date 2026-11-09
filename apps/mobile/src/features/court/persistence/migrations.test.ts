import { describe, expect, test } from "vitest";

import { isKnownSchemaVersion, migrateDatabase } from "./migrations";
import { MIGRATION_STEPS } from "./migrations.data";
import { openNodeSqliteDatabase } from "./node-sqlite-database.test.fixture";

function userVersion(sqlite: ReturnType<typeof openNodeSqliteDatabase>): unknown {
  return sqlite.raw.prepare("PRAGMA user_version").get()?.["user_version"];
}

function tableNames(sqlite: ReturnType<typeof openNodeSqliteDatabase>): readonly unknown[] {
  return sqlite.raw
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
    .all()
    .map((row) => row["name"]);
}

describe("isKnownSchemaVersion", () => {
  test("knows an empty file and every step up to the latest, and nothing else", () => {
    expect(isKnownSchemaVersion(0)).toBe(true);
    expect(isKnownSchemaVersion(MIGRATION_STEPS.length)).toBe(true);
    expect(isKnownSchemaVersion(MIGRATION_STEPS.length + 1)).toBe(false);
    expect(isKnownSchemaVersion(-1)).toBe(false);
  });
});

describe("migrateDatabase", () => {
  test("takes an empty database to the latest version", async () => {
    const sqlite = openNodeSqliteDatabase();

    expect((await migrateDatabase(sqlite.database)).ok).toBe(true);

    expect(userVersion(sqlite)).toBe(MIGRATION_STEPS.length);
    expect(tableNames(sqlite)).toEqual(["court_events", "court_sessions", "device"]);
  });

  test("running again changes nothing", async () => {
    const sqlite = openNodeSqliteDatabase();
    await migrateDatabase(sqlite.database);

    const second = await migrateDatabase(sqlite.database);

    expect(second.ok).toBe(true);
    expect(userVersion(sqlite)).toBe(MIGRATION_STEPS.length);
  });

  test("a database from a newer app is refused and left untouched", async () => {
    const sqlite = openNodeSqliteDatabase();
    const newer = MIGRATION_STEPS.length + 1;
    sqlite.raw.exec(`PRAGMA user_version = ${String(newer)}`);

    const result = await migrateDatabase(sqlite.database);

    expect(result).toEqual({ ok: false, error: { code: "unsupported-database-version" } });
    expect(userVersion(sqlite)).toBe(newer);
    expect(tableNames(sqlite)).toEqual([]);
  });
});
