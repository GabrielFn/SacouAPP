import { randomUUID } from "node:crypto";

import { describe, expect, test } from "vitest";

import { createCourtEventRepository } from "./court-event-repository";
import {
  DEVICE,
  makeEnvelope,
  openMigratedDatabase,
  repositoryOn,
  SESSION_A,
  SESSION_B,
} from "./log-envelopes.test.fixture";

const LOWERCASE_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function openedRepository() {
  const sqlite = await openMigratedDatabase();
  const log = repositoryOn(sqlite);
  await log.openSession(SESSION_A);
  await log.openSession(SESSION_B);
  return { sqlite, log };
}

describe("the device id", () => {
  test("is a lowercase UUID created on the first call and kept after reopening", async () => {
    const sqlite = await openMigratedDatabase();

    const first = await repositoryOn(sqlite).getDeviceId();
    const reopened = await repositoryOn(sqlite).getDeviceId();

    expect(first.ok && LOWERCASE_UUID.test(first.value)).toBe(true);
    expect(reopened).toEqual(first);
  });

  test("differs on a new database", async () => {
    const [one, other] = await Promise.all([openMigratedDatabase(), openMigratedDatabase()]);
    const randomIds = { newId: () => randomUUID() };

    const first = await createCourtEventRepository(one.database, randomIds).getDeviceId();
    const second = await createCourtEventRepository(other.database, randomIds).getDeviceId();

    expect(first).not.toEqual(second);
  });

  test("a stored value that is not a UUID is a corrupted log", async () => {
    const sqlite = await openMigratedDatabase();
    sqlite.raw.exec("INSERT INTO device (singleton, device_id) VALUES (1, 'IMEI-123')");

    expect(await repositoryOn(sqlite).getDeviceId()).toEqual({
      ok: false,
      error: { code: "corrupted-log" },
    });
  });
});

describe("append", () => {
  test("stores both envelopes, in order", async () => {
    const { log } = await openedRepository();
    const envelopes = [makeEnvelope({ sequence: 1 }), makeEnvelope({ sequence: 2 })];

    expect((await log.append(SESSION_A, envelopes)).ok).toBe(true);

    expect(await log.load(SESSION_A)).toEqual({
      ok: true,
      value: {
        batch: 1,
        events: envelopes,
        ackedSequence: 0,
        takenOverBatch: null,
        syncHalt: null,
        fromRound: false,
        ownerKey: null,
      },
    });
  });

  test("stores both or none: a failure on the second insert leaves the file as it was", async () => {
    const { log, sqlite } = await openedRepository();
    await log.append(SESSION_A, [makeEnvelope({ sequence: 1 })]);
    sqlite.failOnRun(2);

    const result = await log.append(SESSION_A, [
      makeEnvelope({ sequence: 2 }),
      makeEnvelope({ sequence: 3 }),
    ]);

    expect(result).toEqual({ ok: false, error: { code: "storage-failed" } });
    const loaded = await log.load(SESSION_A);
    expect(loaded.ok && loaded.value.events.map((event) => event.sequence)).toEqual([1]);
  });

  test("the sequence grows per device and per stream, from 1, without mixing streams", async () => {
    const { log } = await openedRepository();

    const first = await log.append(SESSION_A, [makeEnvelope({ sequence: 1 })]);
    const otherStream = await log.append(SESSION_B, [
      makeEnvelope({ courtSessionId: SESSION_B, sequence: 1, eventNumber: 11 }),
    ]);
    const second = await log.append(SESSION_A, [makeEnvelope({ sequence: 2 })]);

    expect([first.ok, otherStream.ok, second.ok]).toEqual([true, true, true]);
  });

  test.each([
    ["a repeated sequence", 1],
    ["a gap", 3],
    ["a start other than 1 in an empty stream", 5],
  ])("refuses %s", async (_name, sequence) => {
    const { log } = await openedRepository();
    const initial = sequence === 5 ? [] : [makeEnvelope({ sequence: 1 })];
    await log.append(SESSION_A, initial);

    const result = await log.append(SESSION_A, [makeEnvelope({ sequence, eventNumber: 99 })]);

    expect(result).toEqual({ ok: false, error: { code: "sequence-conflict" } });
  });

  test("another device starts its own sequence in the same stream", async () => {
    const { log } = await openedRepository();
    await log.append(SESSION_A, [makeEnvelope({ sequence: 1 })]);
    const other = "d0000000-0000-4000-8000-000000000002";

    const result = await log.append(SESSION_A, [
      makeEnvelope({ deviceId: other, sequence: 1, eventNumber: 50 }),
    ]);

    expect(result.ok).toBe(true);
  });

  test("an unknown session is refused", async () => {
    const { log } = await openedRepository();
    const lost = "c0000000-0000-4000-8000-0000000000ff";

    expect(await log.append(lost, [makeEnvelope({ courtSessionId: lost, sequence: 1 })])).toEqual({
      ok: false,
      error: { code: "session-not-found" },
    });
  });
});

describe("the constraints of the file", () => {
  const INSERT =
    "INSERT INTO court_events (court_session_id, position, event_id, device_id, batch, sequence, schema_version, type, payload) VALUES (?, ?, ?, ?, 1, ?, 1, 'PointScored', '{}')";
  const EVENT_A = "e0000000-0000-4000-8000-000000000001";
  const EVENT_B = "e0000000-0000-4000-8000-000000000002";

  test("a repeated event id is refused by the database", async () => {
    const { sqlite } = await openedRepository();
    sqlite.raw.prepare(INSERT).run(SESSION_A, 1, EVENT_A, DEVICE, 1);

    expect(() => sqlite.raw.prepare(INSERT).run(SESSION_B, 1, EVENT_A, DEVICE, 1)).toThrow(
      /UNIQUE/,
    );
  });

  test("a repeated (batch, sequence, device) in a stream is refused by the database", async () => {
    const { sqlite } = await openedRepository();
    sqlite.raw.prepare(INSERT).run(SESSION_A, 1, EVENT_A, DEVICE, 1);

    expect(() => sqlite.raw.prepare(INSERT).run(SESSION_A, 2, EVENT_B, DEVICE, 1)).toThrow(
      /UNIQUE/,
    );
  });

  test("an event of a session that does not exist is refused by the database", async () => {
    const { sqlite } = await openedRepository();

    expect(() =>
      sqlite.raw.prepare(INSERT).run("c0000000-0000-4000-8000-0000000000ff", 1, EVENT_A, DEVICE, 1),
    ).toThrow(/FOREIGN KEY/);
  });
});

describe("sessions", () => {
  test("finds the open session and stops finding it once closed", async () => {
    const sqlite = await openMigratedDatabase();
    const log = repositoryOn(sqlite);
    expect(await log.findActiveSession()).toEqual({ ok: true, value: null });

    await log.openSession(SESSION_A);
    await log.openSession(SESSION_A);
    expect(await log.findActiveSession()).toEqual({ ok: true, value: SESSION_A });

    await log.closeSession(SESSION_A);
    expect(await log.findActiveSession()).toEqual({ ok: true, value: null });
  });
});
