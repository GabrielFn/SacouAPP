import { describe, expect, test } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import type { CourtEventLog } from "../ports/court-event-log";
import { ROUND } from "../sync/court-sync.test.fixture";
import {
  makeEnvelope,
  openMigratedDatabase,
  repositoryOn,
  SESSION_A,
  SESSION_B,
} from "./log-envelopes.test.fixture";

const TAKEN_OVER = { currentBatch: 2, lastStoredSequence: 0 };

interface Subject {
  readonly name: string;
  readonly create: () => Promise<CourtEventLog>;
}

const SUBJECTS: readonly Subject[] = [
  { name: "SQLite", create: async () => repositoryOn(await openMigratedDatabase()) },
  {
    name: "fake",
    create: () => Promise.resolve(createFakeCourtEventLog(createSequentialIdGenerator())),
  },
];

async function openOfRound(log: CourtEventLog): Promise<string | null> {
  const open = await log.findOpenSessionOfRound(ROUND.roundId);
  if (!open.ok) throw new Error(open.error.code);
  return open.value;
}

describe.each(SUBJECTS)("reopenSession on the $name log (R98)", ({ create }) => {
  test("a closed session opens again with every event it held", async () => {
    const log = await create();
    const device = await log.getDeviceId();
    if (!device.ok) throw new Error(device.error.code);
    await log.openSession(SESSION_A, ROUND);
    const events = [1, 2].map((sequence) => makeEnvelope({ deviceId: device.value, sequence }));
    expect((await log.append(SESSION_A, events)).ok).toBe(true);
    await log.closeSession(SESSION_A);

    expect(await log.reopenSession(SESSION_A)).toEqual({ ok: true, value: undefined });

    expect(await openOfRound(log)).toBe(SESSION_A);
    const loaded = await log.load(SESSION_A);
    expect(loaded.ok && loaded.value.events).toEqual(events);
  });

  test("the other open session of the round closes", async () => {
    const log = await create();
    await log.openSession(SESSION_A, ROUND);
    await log.closeSession(SESSION_A);
    await log.openSession(SESSION_B, ROUND);

    expect((await log.reopenSession(SESSION_A)).ok).toBe(true);

    const active = await log.findActiveSession();
    expect(active).toEqual({ ok: true, value: SESSION_A });
  });

  test("a session taken over is not reopened", async () => {
    const log = await create();
    const device = await log.getDeviceId();
    if (!device.ok) throw new Error(device.error.code);
    await log.openSession(SESSION_A, ROUND);
    await log.markTakenOver(SESSION_A, device.value, TAKEN_OVER);
    await log.closeSession(SESSION_A);

    expect(await log.reopenSession(SESSION_A)).toEqual({
      ok: false,
      error: { code: "taken-over" },
    });
    expect(await openOfRound(log)).toBeNull();
  });

  test("a session that does not exist is session-not-found", async () => {
    const log = await create();

    expect(await log.reopenSession(SESSION_A)).toEqual({
      ok: false,
      error: { code: "session-not-found" },
    });
  });
});
