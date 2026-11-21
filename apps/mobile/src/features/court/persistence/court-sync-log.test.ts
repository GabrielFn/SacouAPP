import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { CourtEventLog } from "../ports/court-event-log";
import { hasContiguousSequences } from "./append-rules";
import {
  DEVICE,
  makeEnvelope,
  openMigratedDatabase,
  repositoryOn,
  SESSION_A,
  SESSION_B,
} from "./log-envelopes.test.fixture";
import { INSERT_EVENT } from "./court-queries.data";
import { migrateDatabase } from "./migrations";
import { MIGRATION_STEPS } from "./migrations.data";
import { openNodeSqliteDatabase } from "./node-sqlite-database.test.fixture";
import { toEventParams } from "./row-mapping";

const ROUND = { groupId: "g0000000-0000-4000-8000-000000000001", roundId: "r1", ownerKey: "key-a" };
const VERSION_TWO = 2;

async function realLog(): Promise<CourtEventLog> {
  return repositoryOn(await openMigratedDatabase());
}

function fakeLog(): Promise<CourtEventLog> {
  return Promise.resolve(createFakeCourtEventLog(createSequentialIdGenerator()));
}

async function withEvents(log: CourtEventLog, count: number): Promise<void> {
  await log.openSession(SESSION_A, ROUND);
  const envelopes = Array.from({ length: count }, (_, index) =>
    makeEnvelope({ sequence: index + 1 }),
  );
  await log.append(SESSION_A, envelopes);
}

async function loaded(log: CourtEventLog) {
  const result = await log.load(SESSION_A);
  if (!result.ok) throw new Error(result.error.code);
  return result.value;
}

describe.each([
  ["SQLite", realLog],
  ["fake", fakeLog],
])("the upload columns of the log (%s, P6)", (_name, open) => {
  test("a new session starts with nothing confirmed, no halt and not taken over", async () => {
    const log = await open();
    await withEvents(log, 2);
    expect(await loaded(log)).toMatchObject({
      ackedSequence: 0,
      takenOverBatch: null,
      syncHalt: null,
    });
  });

  test("markAcknowledged only goes up: a late answer never moves the cursor down", async () => {
    const log = await open();
    await withEvents(log, 5);
    await log.markAcknowledged(SESSION_A, 4);
    await log.markAcknowledged(SESSION_A, 2);
    await log.markAcknowledged(SESSION_A, 4);
    expect((await loaded(log)).ackedSequence).toBe(4);
  });

  test("rewindAcknowledged sets the cursor back for a sequence-gap", async () => {
    const log = await open();
    await withEvents(log, 5);
    await log.markAcknowledged(SESSION_A, 5);
    await log.rewindAcknowledged(SESSION_A, 2);
    expect((await loaded(log)).ackedSequence).toBe(2);
  });

  test("findSessionsToSync lists only sessions with an origin and events above the cursor", async () => {
    const log = await open();
    await withEvents(log, 3);
    await log.openSession(SESSION_B);
    await log.append(SESSION_B, [
      makeEnvelope({ courtSessionId: SESSION_B, sequence: 1, eventNumber: 9 }),
    ]);
    expect(await log.findSessionsToSync(DEVICE)).toEqual({
      ok: true,
      value: [{ courtSessionId: SESSION_A, ...ROUND }],
    });
    await log.markAcknowledged(SESSION_A, 3);
    expect(await log.findSessionsToSync(DEVICE)).toEqual({ ok: true, value: [] });
  });

  test("a closed session still has to be sent; a halted one does not", async () => {
    const log = await open();
    await withEvents(log, 1);
    await log.closeSession(SESSION_A);
    expect(await log.findSessionsToSync(DEVICE)).toEqual({
      ok: true,
      value: [{ courtSessionId: SESSION_A, ...ROUND }],
    });
    await log.haltSync(SESSION_A, "round-canceled");
    expect(await log.findSessionsToSync(DEVICE)).toEqual({ ok: true, value: [] });
    expect((await loaded(log)).syncHalt).toBe("round-canceled");
  });

  test("markTakenOver moves only the own events above the kept sequence, and append is refused", async () => {
    const log = await open();
    await withEvents(log, 6);
    await log.markTakenOver(SESSION_A, DEVICE, { currentBatch: 2, lastStoredSequence: 4 });

    const after = await loaded(log);
    expect(after.events.map((event) => event.sequence)).toEqual([1, 2, 3, 4]);
    expect(hasContiguousSequences(after.events)).toBe(true);
    expect(after).toMatchObject({ ackedSequence: 4, takenOverBatch: 2 });
    expect(await log.append(SESSION_A, [makeEnvelope({ sequence: 5 })])).toEqual({
      ok: false,
      error: { code: "taken-over" },
    });
    expect((await loaded(log)).events).toHaveLength(4);
    expect(await log.findSessionsToSync(DEVICE)).toEqual({ ok: true, value: [] });
  });

  test("the writes of the upload on a missing session are a code", async () => {
    const log = await open();
    const missing = { ok: false, error: { code: "session-not-found" } };
    expect(await log.markAcknowledged(SESSION_A, 1)).toEqual(missing);
    expect(await log.haltSync(SESSION_A, "not-found")).toEqual(missing);
    expect(
      await log.markTakenOver(SESSION_A, DEVICE, { currentBatch: 2, lastStoredSequence: 0 }),
    ).toEqual(missing);
  });
});

describe("the refused events in the SQLite file", () => {
  test("keep the envelopes that left the log, with the batch that refused them", async () => {
    const sqlite = await openMigratedDatabase();
    const log = repositoryOn(sqlite);
    await withEvents(log, 3);
    await log.markTakenOver(SESSION_A, DEVICE, { currentBatch: 2, lastStoredSequence: 1 });
    const rows = sqlite.raw
      .prepare(
        "SELECT sequence, refused_at_batch, seen FROM court_refused_events ORDER BY position",
      )
      .all();
    expect(rows).toEqual([
      { sequence: 2, refused_at_batch: 2, seen: 0 },
      { sequence: 3, refused_at_batch: 2, seen: 0 },
    ]);
  });

  test("a halt outside the closed list cannot be written", async () => {
    const sqlite = await openMigratedDatabase();
    const log = repositoryOn(sqlite);
    await withEvents(log, 1);
    expect(() =>
      sqlite.raw.prepare("UPDATE court_sessions SET sync_halt = 'free text'").run(),
    ).toThrow();
  });
});

describe("migration 3: the upload of the court sessions", () => {
  test("a database on version 2 keeps its session and events, with nothing confirmed", async () => {
    const sqlite = openNodeSqliteDatabase();
    sqlite.raw.exec(MIGRATION_STEPS[0] ?? "");
    sqlite.raw.exec(MIGRATION_STEPS[1] ?? "");
    sqlite.raw.exec(`PRAGMA user_version = ${String(VERSION_TWO)}`);
    sqlite.raw.exec(
      `INSERT INTO court_sessions (court_session_id, status, batch, group_id, round_id) VALUES ('${SESSION_A}', 'open', 1, 'g', 'r')`,
    );
    // Events written by the app of version 2, before the migration (R1).
    const before = [1, 2].map((sequence) => makeEnvelope({ sequence, eventNumber: sequence }));
    before.forEach((envelope, index) => {
      sqlite.raw.prepare(INSERT_EVENT).run(...toEventParams(index + 1, envelope));
    });
    const legacy = repositoryOn(sqlite);
    expect((await migrateDatabase(sqlite.database)).ok).toBe(true);

    expect(sqlite.raw.prepare("PRAGMA user_version").get()?.["user_version"]).toBe(
      MIGRATION_STEPS.length,
    );
    expect(await loaded(legacy)).toMatchObject({
      events: before,
      ackedSequence: 0,
      takenOverBatch: null,
      syncHalt: null,
    });
    expect(
      (await legacy.append(SESSION_A, [makeEnvelope({ sequence: 3, eventNumber: 3 })])).ok,
    ).toBe(true);
    // Without an owner (a session from before this version), nothing ever leaves for any account.
    expect(await legacy.findSessionsToSync(DEVICE)).toEqual({
      ok: true,
      value: [{ courtSessionId: SESSION_A, groupId: "g", roundId: "r", ownerKey: null }],
    });
  });
});
