import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { CourtEventLog, StoredCourtLog } from "../ports/court-event-log";
import {
  DEVICE,
  makeEnvelope,
  openMigratedDatabase,
  repositoryOn,
} from "./log-envelopes.test.fixture";

const KEY_A = "key-a";
const KEY_B = "key-b";
const GROUP = "g0000000-0000-4000-8000-000000000001";
const ROUND_A = "r0000000-0000-4000-8000-00000000000a";
const ROUND_B = "r0000000-0000-4000-8000-00000000000b";
const ROUND_NONE = "r0000000-0000-4000-8000-00000000000c";

const A_OPEN = "c0000000-0000-4000-8000-0000000000a1";
const A_CLOSED = "c0000000-0000-4000-8000-0000000000a2";
const A_TAKEN = "c0000000-0000-4000-8000-0000000000a3";
const B_OPEN = "c0000000-0000-4000-8000-0000000000b1";
const NO_OWNER = "c0000000-0000-4000-8000-0000000000c1";
const SAMPLE = "c0000000-0000-4000-8000-0000000000d1";
const SESSIONS_OF_A = [A_OPEN, A_CLOSED, A_TAKEN] as const;
const KEPT = [B_OPEN, NO_OWNER, SAMPLE] as const;

const EVENTS_PER_SESSION = 3;
const TAKEN_OVER_BATCH = 2;
const KEPT_BY_SERVER = 1;

interface Opened {
  readonly log: CourtEventLog;
  /** How many rows of `court_sessions` the file holds; `null` for the fake, which has no file. */
  readonly sessionRows: () => number | null;
  /** Makes every delete of a session fail inside SQLite; `null` for the fake. */
  readonly blockSessionDeletes: (() => void) | null;
}

async function realLog(): Promise<Opened> {
  const sqlite = await openMigratedDatabase();
  return {
    log: repositoryOn(sqlite),
    sessionRows: () => {
      const row = sqlite.raw.prepare("SELECT COUNT(*) AS value FROM court_sessions").get();
      return Number(row?.["value"]);
    },
    blockSessionDeletes: () => {
      sqlite.raw.exec(
        "CREATE TRIGGER block_delete BEFORE DELETE ON court_sessions BEGIN SELECT RAISE(ABORT, 'blocked'); END;",
      );
    },
  };
}

function fakeLog(): Promise<Opened> {
  return Promise.resolve({
    log: createFakeCourtEventLog(createSequentialIdGenerator()),
    sessionRows: () => null,
    blockSessionDeletes: null,
  });
}

function eventsOf(courtSessionId: string, firstEvent: number) {
  return Array.from({ length: EVENTS_PER_SESSION }, (_, index) =>
    makeEnvelope({ courtSessionId, sequence: index + 1, eventNumber: firstEvent + index }),
  );
}

async function must<T>(result: Promise<{ ok: true; value: T } | { ok: false }>): Promise<T> {
  const settled = await result;
  if (!settled.ok) throw new Error("expected Ok");
  return settled.value;
}

/** A: open with unsent points, closed and confirmed with a halt, taken over with unseen refused ones. */
async function seed(log: CourtEventLog): Promise<void> {
  const sessions: readonly [string, string, string | null, string | null][] = [
    [A_OPEN, ROUND_A, KEY_A, GROUP],
    [A_CLOSED, ROUND_A, KEY_A, GROUP],
    [A_TAKEN, ROUND_A, KEY_A, GROUP],
    [B_OPEN, ROUND_B, KEY_B, GROUP],
    [NO_OWNER, ROUND_NONE, null, GROUP],
    [SAMPLE, ROUND_NONE, null, null],
  ];
  for (const [index, [id, roundId, ownerKey, groupId]] of sessions.entries()) {
    await must(
      log.openSession(
        id,
        groupId === null ? undefined : { groupId, roundId, ownerKey, openedAt: index },
      ),
    );
    await must(log.append(id, eventsOf(id, index * EVENTS_PER_SESSION + 1)));
  }
  await must(log.markAcknowledged(A_CLOSED, EVENTS_PER_SESSION));
  await must(log.haltSync(A_CLOSED, "round-canceled"));
  await must(log.closeSession(A_CLOSED));
  await must(
    log.markTakenOver(A_TAKEN, DEVICE, {
      currentBatch: TAKEN_OVER_BATCH,
      lastStoredSequence: KEPT_BY_SERVER,
    }),
  );
  await must(log.markAcknowledged(B_OPEN, KEPT_BY_SERVER));
  await must(log.haltSync(NO_OWNER, "no-permission"));
}

async function snapshotOf(
  log: CourtEventLog,
  ids: readonly string[],
): Promise<readonly StoredCourtLog[]> {
  return Promise.all(ids.map((id) => must(log.load(id))));
}

describe.each([
  ["SQLite", realLog],
  ["fake", fakeLog],
])("forgetSessionsOf, the court of a deleted account (%s, E6.8)", (_name, open) => {
  test("T1: the sessions of the account leave whole; the others and the device stay as they were", async () => {
    const { log } = await open();
    await seed(log);
    const device = await must(log.getDeviceId());
    const before = await snapshotOf(log, KEPT);
    const refused = await must(log.load(A_TAKEN));
    expect(refused.refused).toHaveLength(EVENTS_PER_SESSION - KEPT_BY_SERVER);

    expect(await log.forgetSessionsOf(KEY_A)).toEqual({ ok: true, value: SESSIONS_OF_A.length });

    for (const id of SESSIONS_OF_A) {
      expect(await log.load(id)).toEqual({ ok: false, error: { code: "session-not-found" } });
    }
    expect(await snapshotOf(log, KEPT)).toEqual(before);
    expect(await must(log.getDeviceId())).toBe(device);
  });

  test("T2: the readers no longer see a session of the account", async () => {
    const { log } = await open();
    await seed(log);
    await must(log.forgetSessionsOf(KEY_A));
    const toSync = await must(log.findSessionsToSync(DEVICE));
    expect(toSync.map((session) => session.courtSessionId)).toEqual([B_OPEN]);
    expect(SESSIONS_OF_A).not.toContain(await must(log.findActiveSession()));
    expect(await must(log.findOpenSessionOfRound(ROUND_A))).toBeNull();
  });

  test("T3: an empty key and a key without sessions forget nothing", async () => {
    const { log } = await open();
    await seed(log);
    const before = await snapshotOf(log, [...SESSIONS_OF_A, ...KEPT]);
    expect(await log.forgetSessionsOf("")).toEqual({ ok: true, value: 0 });
    expect(await log.forgetSessionsOf("key-nobody")).toEqual({ ok: true, value: 0 });
    expect(await snapshotOf(log, [...SESSIONS_OF_A, ...KEPT])).toEqual(before);
  });

  test("T3: an empty key never reaches the SQL, even for a session stored with an empty owner", async () => {
    const { log } = await open();
    await log.openSession(SAMPLE, { groupId: GROUP, roundId: ROUND_NONE, ownerKey: "" });
    expect(await log.forgetSessionsOf("")).toEqual({ ok: true, value: 0 });
    expect((await log.load(SAMPLE)).ok).toBe(true);
  });

  test("T4: a second call finds nothing more", async () => {
    const { log } = await open();
    await seed(log);
    expect(await log.forgetSessionsOf(KEY_A)).toEqual({ ok: true, value: SESSIONS_OF_A.length });
    expect(await log.forgetSessionsOf(KEY_A)).toEqual({ ok: true, value: 0 });
  });

  test("T5: a late answer of the upload on a forgotten session is a code and recreates nothing", async () => {
    const { log, sessionRows } = await open();
    await seed(log);
    await must(log.forgetSessionsOf(KEY_A));
    const rows = sessionRows();
    const notFound = { ok: false, error: { code: "session-not-found" } };
    expect(await log.markAcknowledged(A_OPEN, EVENTS_PER_SESSION)).toEqual(notFound);
    expect(await log.haltSync(A_OPEN, "client-bug")).toEqual(notFound);
    expect(
      await log.markTakenOver(A_OPEN, DEVICE, {
        currentBatch: TAKEN_OVER_BATCH,
        lastStoredSequence: 0,
      }),
    ).toEqual(notFound);
    expect(await log.append(A_OPEN, eventsOf(A_OPEN, 1))).toEqual(notFound);
    expect(await log.load(A_OPEN)).toEqual(notFound);
    expect(sessionRows()).toBe(rows);
  });
});

describe("forgetSessionsOf in one transaction (SQLite, E6.8)", () => {
  test("T6: a failure after the first delete keeps every row and answers storage-failed", async () => {
    const { log, blockSessionDeletes } = await realLog();
    await seed(log);
    const before = await snapshotOf(log, [...SESSIONS_OF_A, ...KEPT]);
    blockSessionDeletes?.();
    expect(await log.forgetSessionsOf(KEY_A)).toEqual({
      ok: false,
      error: { code: "storage-failed" },
    });
    expect(await snapshotOf(log, [...SESSIONS_OF_A, ...KEPT])).toEqual(before);
  });
});
