import { describe, expect, test } from "vitest";

import { CorrectionPlayer } from "../corrections/correction-player.test.fixture.js";
import { confirmSetEnd, startMatch } from "../score/commands.js";
import { rotationMatchInput } from "../score/match-player.test.fixture.js";
import type { ScoringRules } from "../score/types.js";
import { getSideStats } from "./side-stats.js";

const ONE_SHORT_SET: ScoringRules = {
  bestOf: 1,
  pointsPerSet: 3,
  tieBreakPoints: 3,
  winMargin: 2,
};
const SECOND_MATCH_ID = "f0000000-0000-4000-8000-0000000000aa";

describe("getSideStats: a side is the side of the court, not the players", () => {
  test("two teams swapping sides: the side that won both counts two wins in a row", () => {
    const first = rotationMatchInput(ONE_SHORT_SET);
    const second = {
      ...first,
      matchId: SECOND_MATCH_ID,
      teams: { a: first.teams.b, b: first.teams.a },
      rotations: { a: null, b: null },
    };

    const timeline = CorrectionPlayer.start({ ...first, rotations: { a: null, b: null } })
      .rallies("aaa")
      .run(confirmSetEnd)
      .run((state) => startMatch(state, second))
      .rallies("aaa")
      .run(confirmSetEnd)
      .timeline();

    expect(getSideStats(timeline)).toStrictEqual({
      a: { wins: 2, longestWinStreak: 2, currentWinStreak: 2 },
      b: { wins: 0, longestWinStreak: 0, currentWinStreak: 0 },
    });
  });
});
