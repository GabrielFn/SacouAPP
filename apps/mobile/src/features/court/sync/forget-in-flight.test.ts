import { describe, expect, test, vi } from "vitest";

import { createFakeCourtEventLog } from "../../../adapters/fake-court-event-log";
import { createSequentialIdGenerator } from "../../../adapters/fake-sequential-id-generator";
import {
  makeEnvelope,
  openMigratedDatabase,
  repositoryOn,
  SESSION_A,
  SESSION_B,
} from "../persistence/log-envelopes.test.fixture";
import type { CourtEventLog } from "../ports/court-event-log";
import { accountRef, createSyncHarness, ROUND, settled } from "./court-sync.test.fixture";
import { MAX_BACKOFF_MS } from "./sync.data";

const OTHER_ROUND = { ...ROUND, roundId: "r0000000-0000-4000-8000-000000000002" };
const EVENTS_OF_B = 2;
const FIRST_EVENT_OF_B = 100;

async function realLog(): Promise<CourtEventLog> {
  return repositoryOn(await openMigratedDatabase());
}

function fakeLog(): Promise<CourtEventLog> {
  return Promise.resolve(createFakeCourtEventLog(createSequentialIdGenerator()));
}

describe.each([
  ["SQLite", realLog],
  ["fake", fakeLog],
])("the account deleted while a batch is out (%s, E6.8, T10)", (_name, open) => {
  test("the late answer finds no session, nothing throws, and the loop goes on to the next account", async () => {
    const harness = await createSyncHarness({ log: await open() });
    const other = accountRef("b");
    await harness.log.openSession(SESSION_B, { ...OTHER_ROUND, ownerKey: other.key });
    const ofB = Array.from({ length: EVENTS_OF_B }, (_, index) =>
      makeEnvelope({
        courtSessionId: SESSION_B,
        deviceId: harness.deviceId,
        sequence: index + 1,
        eventNumber: FIRST_EVENT_OF_B + index,
      }),
    );
    expect((await harness.log.append(SESSION_B, ofB)).ok).toBe(true);

    const release = harness.server.holdNext();
    await harness.write(2);
    await vi.waitFor(() => {
      expect(harness.server.requests()).toHaveLength(1);
    });
    expect(await harness.log.forgetSessionsOf(harness.owner.key)).toEqual({ ok: true, value: 1 });
    release();
    await settled(harness.sync());

    expect((await harness.log.load(SESSION_A)).ok).toBe(false);
    harness.account.switchTo(other);
    harness.scheduler.advance(MAX_BACKOFF_MS);
    await settled(harness.sync());
    // The fake server holds one stream, so the request of B is the proof the loop went on.
    const ofOther = harness.server
      .requests()
      .filter((request) => request.account === other.session);
    expect(ofOther.map((request) => request.ref.courtSessionId)).toContain(SESSION_B);
    expect(ofOther.every((request) => request.ref.courtSessionId === SESSION_B)).toBe(true);
    expect((await harness.log.load(SESSION_B)).ok).toBe(true);
  });
});
