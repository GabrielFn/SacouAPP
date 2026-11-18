import type { EventEnvelope } from "@sacou/match-engine";
import { parseEventEnvelope } from "@sacou/match-engine";
import { describe, expect, test } from "vitest";

import type { CourtEventLog, ServerStreamImport } from "../ports/court-event-log";
import {
  DEVICE,
  makeEnvelope,
  openMigratedDatabase,
  repositoryOn,
  SESSION_A,
  SESSION_B,
} from "./log-envelopes.test.fixture";

const ROUND = { groupId: "g0000000-0000-4000-8000-000000000001", roundId: "r1" };
const OWNER = { ...ROUND, ownerKey: "key-b" };
const OTHER_DEVICE = "d0000000-0000-4000-8000-000000000002";
const TAKEN_BATCH = 2;

function withBatch(envelope: EventEnvelope, batch: number): EventEnvelope {
  const parsed = parseEventEnvelope({ ...envelope, batch });
  if (!parsed.ok) throw new Error("invalid envelope");
  return parsed.value;
}

/** The stream of the server: `count` events of another phone. */
function otherPhoneEvents(count: number, courtSessionId = SESSION_A): readonly EventEnvelope[] {
  return Array.from({ length: count }, (_, index) =>
    makeEnvelope({
      courtSessionId,
      deviceId: OTHER_DEVICE,
      sequence: index + 1,
      eventNumber: 100 + index,
    }),
  );
}

function imported(overrides: Partial<ServerStreamImport> = {}): ServerStreamImport {
  return {
    courtSessionId: SESSION_A,
    origin: OWNER,
    deviceId: DEVICE,
    events: otherPhoneEvents(3),
    batch: TAKEN_BATCH,
    lastSequence: 0,
    ...overrides,
  };
}

async function realLog(): Promise<CourtEventLog> {
  return repositoryOn(await openMigratedDatabase());
}

async function loadOk(log: CourtEventLog, courtSessionId = SESSION_A) {
  const loaded = await log.load(courtSessionId);
  if (!loaded.ok) throw new Error(loaded.error.code);
  return loaded.value;
}

describe("replaceWithServerStream (E4.11, D5)", () => {
  test("a phone without the session gets the stream, the batch and the cursor, and writes next", async () => {
    const log = await realLog();

    expect((await log.replaceWithServerStream(imported())).ok).toBe(true);

    const stored = await loadOk(log);
    expect(stored.events).toEqual(otherPhoneEvents(3));
    expect(stored).toMatchObject({
      batch: TAKEN_BATCH,
      ackedSequence: 0,
      takenOverBatch: null,
      syncHalt: null,
      fromRound: true,
      ownerKey: "key-b",
      refused: [],
    });
    const next = withBatch(makeEnvelope({ sequence: 1, eventNumber: 900 }), TAKEN_BATCH);
    expect((await log.append(SESSION_A, [next])).ok).toBe(true);
    const sync = await log.findSessionsToSync(DEVICE);
    expect(sync.ok && sync.value.map((session) => session.courtSessionId)).toEqual([SESSION_A]);
  });

  test("taking back: the refused ones are dropped and the sequence goes on in the new batch", async () => {
    const log = await realLog();
    await log.openSession(SESSION_A, OWNER);
    const own = Array.from({ length: 4 }, (_, index) => makeEnvelope({ sequence: index + 1 }));
    await log.append(SESSION_A, own);
    await log.markTakenOver(SESSION_A, DEVICE, { currentBatch: 2, lastStoredSequence: 2 });
    expect((await loadOk(log)).refused).toHaveLength(2);
    const stream = [
      ...own.slice(0, 2),
      ...otherPhoneEvents(2).map((event) => withBatch(event, 2)),
    ];

    expect(
      (
        await log.replaceWithServerStream(
          imported({ events: stream, batch: 3, lastSequence: 2 }),
        )
      ).ok,
    ).toBe(true);

    const stored = await loadOk(log);
    expect(stored).toMatchObject({ batch: 3, ackedSequence: 2, takenOverBatch: null, refused: [] });
    const next = withBatch(makeEnvelope({ sequence: 3, eventNumber: 901 }), 3);
    expect((await log.append(SESSION_A, [next])).ok).toBe(true);
  });

  test("another open session of the round: its unsent points become refused and it closes", async () => {
    const log = await realLog();
    await log.openSession(SESSION_B, OWNER);
    await log.append(SESSION_B, [
      makeEnvelope({ courtSessionId: SESSION_B, sequence: 1, eventNumber: 50 }),
      makeEnvelope({ courtSessionId: SESSION_B, sequence: 2, eventNumber: 51 }),
    ]);

    expect((await log.replaceWithServerStream(imported())).ok).toBe(true);

    const old = await loadOk(log, SESSION_B);
    expect(old.events).toEqual([]);
    expect(old.refused).toHaveLength(2);
    expect(old.takenOverBatch).toBe(TAKEN_BATCH);
    expect(await log.findOpenSessionOfRound(ROUND.roundId)).toEqual({ ok: true, value: SESSION_A });
    const sync = await log.findSessionsToSync(DEVICE);
    expect(sync.ok && sync.value).toEqual([]);
  });

  test.each([
    ["another stream", imported({ events: otherPhoneEvents(2, SESSION_B) })],
    ["a gap in the sequences", imported({ events: otherPhoneEvents(3).slice(1) })],
    ["a cursor the stream does not have", imported({ lastSequence: 4 })],
    ["a batch out of range", imported({ batch: 0 })],
  ])("refuses %s and leaves the file as it was", async (_, stream) => {
    const log = await realLog();
    await log.openSession(SESSION_A, OWNER);
    await log.append(SESSION_A, [makeEnvelope({ sequence: 1 })]);

    expect(await log.replaceWithServerStream(stream)).toEqual({
      ok: false,
      error: { code: "sequence-conflict" },
    });

    const stored = await loadOk(log);
    expect(stored.events).toEqual([makeEnvelope({ sequence: 1 })]);
    expect(stored.batch).toBe(1);
  });
});

describe("refused events on the log (E4.11, D6)", () => {
  test("load lists them in order, unseen until 'Entendi'", async () => {
    const log = await realLog();
    await log.openSession(SESSION_A, OWNER);
    await log.append(
      SESSION_A,
      Array.from({ length: 3 }, (_, index) => makeEnvelope({ sequence: index + 1 })),
    );
    await log.markTakenOver(SESSION_A, DEVICE, { currentBatch: 2, lastStoredSequence: 1 });

    const before = await loadOk(log);
    expect(before.refused.map((event) => event.sequence)).toEqual([2, 3]);
    expect(before.refusedUnseen).toBe(true);

    expect((await log.markRefusedSeen(SESSION_A)).ok).toBe(true);
    const after = await loadOk(log);
    expect(after.refused).toHaveLength(2);
    expect(after.refusedUnseen).toBe(false);
  });

  test("marking an unknown session is a code, not a silent no-op", async () => {
    const log = await realLog();
    expect(await log.markRefusedSeen(SESSION_B)).toEqual({
      ok: false,
      error: { code: "session-not-found" },
    });
  });
});
