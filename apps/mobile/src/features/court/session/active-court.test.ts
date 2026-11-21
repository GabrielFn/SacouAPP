import { describe, expect, test } from "vitest";

import { readActiveCourt } from "./active-court";
import {
  OLD_ROUND,
  OLD_SESSION,
  ONE_POINT_MATCH,
  openWithMatch,
  play,
  testCourt,
} from "./open-court.test.fixture";

const ROUND_ONLY = { includeSamples: false };

describe("readActiveCourt: the bar EM QUADRA of the home (R97, D1)", () => {
  test("without an open session there is no bar", async () => {
    expect(await readActiveCourt(testCourt(), ROUND_ONLY)).toBeNull();
  });

  test("a match being played shows its round and the score of the set", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);

    expect(await readActiveCourt(court, ROUND_ONLY)).toEqual({
      courtSessionId: OLD_SESSION,
      origin: OLD_ROUND,
      score: { a: 0, b: 0 },
    });
  });

  test("a set waiting for its confirmation (set-decided) still shows the bar, with its score", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    await play(court, [{ type: "score-point", team: "b" }]);

    expect((await readActiveCourt(court, ROUND_ONLY))?.score).toEqual({ a: 0, b: 1 });
  });

  test("a match between sets (match-pending) still shows the bar", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    await play(court, [{ type: "score-point", team: "a" }, { type: "confirm-set-end" }]);

    expect((await readActiveCourt(court, ROUND_ONLY))?.courtSessionId).toBe(OLD_SESSION);
  });

  test("a match that ended hides the bar", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND, ONE_POINT_MATCH);
    await play(court, [{ type: "score-point", team: "a" }, { type: "confirm-set-end" }]);

    expect(await readActiveCourt(court, ROUND_ONLY)).toBeNull();
  });

  test("a closed session hides the bar", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    await court.log.closeSession(OLD_SESSION);

    expect(await readActiveCourt(court, ROUND_ONLY)).toBeNull();
  });

  test("a log that does not load shows no bar and does not throw", async () => {
    const court = testCourt();
    await openWithMatch(court, OLD_ROUND);
    const broken = {
      ...court,
      log: {
        ...court.log,
        load: () =>
          Promise.resolve({ ok: false as const, error: { code: "corrupted-log" as const } }),
      },
    };

    expect(await readActiveCourt(broken, ROUND_ONLY)).toBeNull();
  });

  test("a sample session (no round) shows only with the development tools", async () => {
    const court = testCourt();
    await openWithMatch(court, null);

    expect(await readActiveCourt(court, ROUND_ONLY)).toBeNull();
    expect((await readActiveCourt(court, { includeSamples: true }))?.origin).toBeNull();
  });
});
