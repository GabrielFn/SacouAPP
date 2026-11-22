import { describe, expect, test } from "vitest";

import { createCourtEventRepository } from "../persistence/court-event-repository";
import { openMigratedDatabase, SESSION_A } from "../persistence/log-envelopes.test.fixture";
import { accountRef, ROUND } from "../sync/court-sync.test.fixture";
import { createFakeCourtStreamServer } from "../sync/fake-court-stream-server.test.fixture";
import { runTakeover } from "./run-takeover";
import { createPhone, openAndScore, type Phone } from "./takeover.test.fixture";

const POINTS = 3;
const EVENTS = POINTS + 1;
const SHORT_COPY = 2;

/**
 * Phone A scored and sent everything, then a copy of its log (same device id) is written on a fresh
 * database as a closed session of `ownerKey`, holding only the first `keep` events.
 */
async function copyOfTheLog(ownerKey: string, keep: number) {
  const server = createFakeCourtStreamServer();
  const a: Phone = await createPhone(1, server);
  await openAndScore(a, SESSION_A, POINTS);
  const full = await a.load(SESSION_A);
  const copy = createCourtEventRepository((await openMigratedDatabase()).database, {
    newId: () => a.deviceId,
  });
  await copy.openSession(SESSION_A, { ...ROUND, ownerKey });
  const appended = await copy.append(SESSION_A, full.events.slice(0, keep));
  expect(appended.ok).toBe(true);
  expect((await copy.closeSession(SESSION_A)).ok).toBe(true);
  const summary = await server.api.getCourtSession(ROUND.groupId, ROUND.roundId, a.owner.session);
  if (!summary.ok) throw new Error("no summary");
  const types: string[] = [];
  await runTakeover(
    { ...a.takeoverDeps(), log: copy },
    { origin: ROUND, summary: summary.value },
    (action) => {
      types.push(action.type);
    },
  );
  const loaded = await copy.load(SESSION_A);
  if (!loaded.ok) throw new Error(loaded.error.code);
  return { server, a, stored: loaded.value, types };
}

describe("the local log is kept only when it is this account's and holds all the server has (R98)", () => {
  test("a closed session of another local account is replaced by the stream of the server", async () => {
    const other = accountRef("someone-else").key;

    const { server, a, stored } = await copyOfTheLog(other, EVENTS);

    expect(stored.ownerKey).toBe(a.owner.key);
    expect(stored.events).toEqual(server.stored());
  });

  test("a local log behind the last sequence of the server is replaced, not reopened", async () => {
    const { a, server, stored } = await copyOfTheLog(accountRef("phone-1").key, SHORT_COPY);

    expect(stored.events).toHaveLength(EVENTS);
    expect(stored.events).toEqual(server.stored());
    expect(stored.ownerKey).toBe(a.owner.key);
  });
});
