import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, test } from "vitest";

import { openNodeSqliteDatabase } from "../features/court/persistence/node-sqlite-database.test.fixture";
import type { IdTokenProvider } from "../services/api/id-token-provider";
import type { HttpTransport } from "../services/api/http-transport";
import type { NetworkStatus } from "../services/api/network-status";
import type { SacouApi } from "../services/api/sacou-api";
import type { KeyValueStore } from "../services/query/key-value-store";
import {
  CACHE_DATABASE_FILE,
  createSqliteKeyValueStore,
  migrateCacheDatabase,
} from "./sqlite-key-value-store";
import { createFakeHttpTransport } from "./fake-http-transport";
import { createFakeIdTokenProvider } from "./fake-id-token-provider";
import { createFakeNetworkStatus } from "./fake-network-status";
import { createFakeSacouApi } from "./fake-sacou-api";
import { createMemoryKeyValueStore } from "./memory-key-value-store";

async function openCacheStore() {
  const sqlite = openNodeSqliteDatabase();
  await migrateCacheDatabase(sqlite.database);
  return { sqlite, store: createSqliteKeyValueStore(sqlite.database) };
}

describe("sqlite-key-value-store (Q7)", () => {
  test("a strict table with one row per key: write, overwrite, read and remove", async () => {
    const { sqlite, store } = await openCacheStore();

    await store.setItem("k", "one");
    await store.setItem("k", "two");
    expect(await store.getItem("k")).toBe("two");
    expect(sqlite.raw.prepare("SELECT count(*) AS n FROM kv").get()).toEqual({ n: 1 });
    await store.removeItem("k");
    expect(await store.getItem("k")).toBeNull();

    const table = sqlite.raw.prepare("SELECT sql FROM sqlite_schema WHERE name = 'kv'").get();
    expect(String(table?.sql)).toContain("STRICT");
  });

  test("the migration is kept, and an unknown version starts empty", async () => {
    const { sqlite, store } = await openCacheStore();
    await store.setItem("k", "kept");

    await migrateCacheDatabase(sqlite.database);
    expect(await store.getItem("k")).toBe("kept");

    sqlite.raw.exec("PRAGMA user_version = 9");
    await migrateCacheDatabase(sqlite.database);
    expect(await store.getItem("k")).toBeNull();
    expect(sqlite.raw.prepare("PRAGMA user_version").get()).toEqual({ user_version: 1 });
  });

  test("the cache has its own file, apart from the court's", () => {
    const opener = readFileSync(join(__dirname, "expo-court-runtime-opener.ts"), "utf8");
    expect(CACHE_DATABASE_FILE).toBe("sacou-cache.db");
    expect(opener).toContain('"sacou.db"');
    expect(opener).not.toContain(CACHE_DATABASE_FILE);
  });

  test("a value is a parameter, never SQL text", async () => {
    const { store } = await openCacheStore();
    const tricky = "x'); DROP TABLE kv; --";

    await store.setItem(tricky, tricky);

    expect(await store.getItem(tricky)).toBe(tricky);
  });
});

describe("the app keeps cleartext traffic off (A2)", () => {
  test("app.json does not turn usesCleartextTraffic on", () => {
    const appJson = readFileSync(join(__dirname, "..", "..", "app.json"), "utf8");
    expect(appJson).not.toMatch(/usesCleartextTraffic/);
  });
});

describe("each new port has a fake with the same contract (A3)", () => {
  test("the fakes satisfy the ports", () => {
    const fakes = {
      api: createFakeSacouApi().api satisfies SacouApi,
      tokens: createFakeIdTokenProvider() satisfies IdTokenProvider,
      transport: createFakeHttpTransport().transport satisfies HttpTransport,
      network: createFakeNetworkStatus() satisfies NetworkStatus,
      store: createMemoryKeyValueStore() satisfies KeyValueStore,
    };
    expect(Object.keys(fakes)).toHaveLength(5);
  });

  test("the fake network tells its listeners until they stop", () => {
    const network = createFakeNetworkStatus(true);
    const heard: boolean[] = [];
    const stop = network.subscribe((online) => heard.push(online));

    network.set(false);
    stop();
    network.set(true);

    expect(heard).toEqual([false]);
    expect(network.isOnline()).toBe(true);
  });

  test("the fake API records the calls and answers what was programmed", async () => {
    const fake = createFakeSacouApi();

    expect(await fake.api.listMyGroups()).toEqual({
      ok: false,
      error: { kind: "unexpected", status: 0 },
    });
    fake.respond("listMyGroups", { ok: true, value: [] });
    expect(await fake.api.listMyGroups()).toEqual({ ok: true, value: [] });
    expect(fake.calls()).toEqual([
      { operation: "listMyGroups", args: [] },
      { operation: "listMyGroups", args: [] },
    ]);
  });
});
