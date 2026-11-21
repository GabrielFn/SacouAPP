import { describe, expect, test } from "vitest";

import { startFromDraw } from "../../draw/session/start-from-draw";
import { g1Input } from "../../draw/model/pre-game.test.fixture";
import { closeStaleCourt } from "./close-stale-court";
import {
  ACCOUNT_A,
  ACCOUNT_B,
  NEW_ROUND,
  OLD_ROUND,
  OLD_SESSION,
  openWithMatch,
  play,
  testCourt,
  type TestCourt,
} from "./open-court.test.fixture";
import { readOtherRoundCourt } from "./other-round-court";

async function typesOf(court: TestCourt, courtSessionId: string): Promise<readonly string[]> {
  const stored = await court.log.load(courtSessionId);
  return stored.ok ? stored.value.events.map((event) => event.type) : [];
}

async function sessionsToSync(court: TestCourt): Promise<readonly string[]> {
  const device = await court.log.getDeviceId();
  const found = await court.log.findSessionsToSync(device.ok ? device.value : "");
  return found.ok ? found.value.map((session) => session.courtSessionId) : [];
}

describe("closeStaleCourt and the start of a new round (R97, D5)", () => {
  test("confirming ends the old match, closes its session and starts the new one", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    await play(court, [{ type: "score-point", team: "a" }]);

    const started = await startFromDraw(court, NEW_ROUND, g1Input(), OLD_SESSION);

    expect(started.ok).toBe(true);
    expect((await typesOf(court, OLD_SESSION)).at(-1)).toBe("MatchEnded");
    expect(await court.log.findOpenSessionOfRound(OLD_ROUND.roundId)).toEqual({
      ok: true,
      value: null,
    });
    const fresh = started.ok ? started.value : "";
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: fresh });
    // The points of the old match were never sent: closing keeps them in the upload.
    expect(await sessionsToSync(court)).toContain(OLD_SESSION);
    expect(court.appended.count).toBeGreaterThan(0);
  });

  test("without the confirmation the start stays refused and nothing changes", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    const before = await typesOf(court, OLD_SESSION);

    expect(await startFromDraw(court, NEW_ROUND, g1Input())).toEqual({
      ok: false,
      error: "other-round-match-open",
    });
    expect(await typesOf(court, OLD_SESSION)).toEqual(before);
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: OLD_SESSION });
  });

  test("a session of another account is never ended nor closed", async () => {
    const court = testCourt({ key: ACCOUNT_B });
    await openWithMatch(court, OLD_ROUND, undefined, ACCOUNT_A);
    const before = await typesOf(court, OLD_SESSION);

    expect(await closeStaleCourt(court, OLD_SESSION)).toEqual({
      ok: false,
      error: "other-account",
    });
    expect(await startFromDraw(court, NEW_ROUND, g1Input(), OLD_SESSION)).toEqual({
      ok: false,
      error: "close-other-failed",
    });
    expect(await typesOf(court, OLD_SESSION)).toEqual(before);
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: OLD_SESSION });
  });

  test("a session another phone took over is closed with nothing appended", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    const device = await court.log.getDeviceId();
    await court.log.markTakenOver(OLD_SESSION, device.ok ? device.value : "", {
      currentBatch: 2,
      lastStoredSequence: 1,
    });
    const before = await typesOf(court, OLD_SESSION);

    expect(await closeStaleCourt(court, OLD_SESSION)).toEqual({ ok: true, value: undefined });
    expect(await typesOf(court, OLD_SESSION)).toEqual(before);
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: null });
  });

  test("a session that cannot be read stays open", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    const broken: TestCourt = {
      ...court,
      log: {
        ...court.log,
        load: () =>
          Promise.resolve({ ok: false as const, error: { code: "corrupted-log" as const } }),
      },
    };

    expect(await closeStaleCourt(broken, OLD_SESSION)).toEqual({ ok: false, error: "failed" });
    expect(await court.log.findActiveSession()).toEqual({ ok: true, value: OLD_SESSION });
  });
});

describe("readOtherRoundCourt: the match of another round, seen by the 08 (R97, D2)", () => {
  test("a match on in another round gives its session and whose it is", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);

    expect(await readOtherRoundCourt(court, NEW_ROUND.roundId)).toEqual({
      ok: true,
      value: { courtSessionId: OLD_SESSION, origin: OLD_ROUND, ownership: "own" },
    });
  });

  test("the session of this same round is not another round", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);

    expect(await readOtherRoundCourt(court, OLD_ROUND.roundId)).toEqual({ ok: true, value: null });
  });

  test("another round without a match on is no obstacle (it closes in silence)", async () => {
    const court = testCourt();
    await court.log.openSession(OLD_SESSION, { ...OLD_ROUND, ownerKey: ACCOUNT_A });

    expect(await readOtherRoundCourt(court, NEW_ROUND.roundId)).toEqual({ ok: true, value: null });
  });

  test("another account's session says so", async () => {
    const court = testCourt({ key: ACCOUNT_B });
    await openWithMatch(court, OLD_ROUND, undefined, ACCOUNT_A);
    const read = await readOtherRoundCourt(court, NEW_ROUND.roundId);

    expect(read.ok && read.value?.ownership).toBe("other-account");
  });
});
