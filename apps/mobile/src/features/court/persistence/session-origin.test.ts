import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { CourtEventLog } from "../ports/court-event-log";
import { migrateDatabase } from "./migrations";
import { MIGRATION_STEPS } from "./migrations.data";
import { openNodeSqliteDatabase } from "./node-sqlite-database.test.fixture";
import {
  openMigratedDatabase,
  repositoryOn,
  SESSION_A,
  SESSION_B,
} from "./log-envelopes.test.fixture";

const ORIGIN = { groupId: "group-1", roundId: "round-1" };
const OTHER_ORIGIN = { groupId: "group-1", roundId: "round-2" };
const VERSION_ONE = 1;

async function realLog(): Promise<CourtEventLog> {
  return repositoryOn(await openMigratedDatabase());
}

function fakeLog(): Promise<CourtEventLog> {
  return Promise.resolve(createFakeCourtEventLog(createSequentialIdGenerator()));
}

describe.each([
  ["SQLite", realLog],
  ["fake", fakeLog],
])("the origin of a court session (%s)", (_name, open) => {
  test("findOpenSessionOfRound finds only the session of the round", async () => {
    const log = await open();
    await log.openSession(SESSION_A, ORIGIN);
    await log.openSession(SESSION_B, OTHER_ORIGIN);

    expect(await log.findOpenSessionOfRound("round-1")).toEqual({ ok: true, value: SESSION_A });
    expect(await log.findOpenSessionOfRound("round-3")).toEqual({ ok: true, value: null });
  });

  test("findOrigin reads the origin back; a sample session or a missing one has none", async () => {
    const log = await open();
    await log.openSession(SESSION_A, ORIGIN);
    await log.openSession(SESSION_B);

    expect(await log.findOrigin(SESSION_A)).toEqual({ ok: true, value: ORIGIN });
    expect(await log.findOrigin(SESSION_B)).toEqual({ ok: true, value: null });
    expect(await log.findOrigin("missing")).toEqual({ ok: true, value: null });
  });

  test("findOpenedAt reads the opening back, kept from the creation; none is null (R97, D4)", async () => {
    const log = await open();
    const openedAt = Date.parse("2026-11-20T12:00:00Z");
    await log.openSession(SESSION_A, { ...ORIGIN, openedAt });
    await log.openSession(SESSION_A, { ...ORIGIN, openedAt: openedAt + 1 });
    await log.openSession(SESSION_B, ORIGIN);

    expect(await log.findOpenedAt(SESSION_A)).toEqual({ ok: true, value: openedAt });
    expect(await log.findOpenedAt(SESSION_B)).toEqual({ ok: true, value: null });
    expect(await log.findOpenedAt("missing")).toEqual({ ok: true, value: null });
  });

  test("the origin is written only when the session is created", async () => {
    const log = await open();
    await log.openSession(SESSION_A, ORIGIN);
    await log.openSession(SESSION_A, OTHER_ORIGIN);
    await log.openSession(SESSION_A);

    expect(await log.findOpenSessionOfRound("round-1")).toEqual({ ok: true, value: SESSION_A });
    expect(await log.findOpenSessionOfRound("round-2")).toEqual({ ok: true, value: null });
  });

  test("a closed session is not found, and a sample session has no round", async () => {
    const log = await open();
    await log.openSession(SESSION_A, ORIGIN);
    await log.closeSession(SESSION_A);
    await log.openSession(SESSION_B);

    expect(await log.findOpenSessionOfRound("round-1")).toEqual({ ok: true, value: null });
    expect(await log.findActiveSession()).toEqual({ ok: true, value: SESSION_B });
  });
});

describe("migration 2: the origin of the court sessions", () => {
  test("a database on version 1 keeps its open session, with no origin", async () => {
    const sqlite = openNodeSqliteDatabase();
    sqlite.raw.exec(MIGRATION_STEPS[0] ?? "");
    sqlite.raw.exec(`PRAGMA user_version = ${String(VERSION_ONE)}`);
    sqlite.raw.exec(
      `INSERT INTO court_sessions (court_session_id, status, batch) VALUES ('${SESSION_A}', 'open', 1)`,
    );

    expect((await migrateDatabase(sqlite.database)).ok).toBe(true);

    expect(sqlite.raw.prepare("PRAGMA user_version").get()?.["user_version"]).toBe(
      MIGRATION_STEPS.length,
    );
    expect(
      sqlite.raw
        .prepare("SELECT court_session_id, status, batch, group_id, round_id FROM court_sessions")
        .all(),
    ).toEqual([
      { court_session_id: SESSION_A, status: "open", batch: 1, group_id: null, round_id: null },
    ]);
    const log = repositoryOn(sqlite);
    expect(await log.findActiveSession()).toEqual({ ok: true, value: SESSION_A });
    expect(await log.findOpenSessionOfRound("round-1")).toEqual({ ok: true, value: null });
  });
});
