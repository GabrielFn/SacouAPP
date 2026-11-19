import { describe, expect, test } from "vitest";

import { CorrectionPlayer } from "../corrections/correction-player.test.fixture.js";
import { endMatchManually } from "../score/commands.js";
import { matchInput } from "../score/match-player.test.fixture.js";
import type { ScoringRules } from "../score/types.js";
import { SETTINGS_MODALITIES } from "../settings/constants.data.js";
import { firstDifference, firstOf } from "./compare.js";
import { BEACH_MODALITIES, MVP_FORMULA_VERSION } from "./constants.data.js";
import { getMatchResults } from "./match-results.js";
import { getMainSide, getPlayerMvp, getTeamMvp } from "./mvp.js";
import { getRoundSummary, isBeachModality } from "./round-summary.js";
import { getSideHighlights } from "./side-highlights.js";
import type { RoundSummaryOptions } from "./types.js";

const ONE_SHORT_SET: ScoringRules = {
  bestOf: 1,
  pointsPerSet: 3,
  tieBreakPoints: null,
  winMargin: 2,
};
const INDOOR: RoundSummaryOptions = {
  modality: "indoor-6x6",
  mvpEnabled: true,
  mvpByStats: true,
  individualPoints: true,
};
const ABSENT = "z0000000-0000-4000-8000-000000000001";

describe("modalities", () => {
  test("the sand is every modality but the indoor one", () => {
    expect(BEACH_MODALITIES).toStrictEqual(
      SETTINGS_MODALITIES.filter((modality) => modality !== "indoor-6x6"),
    );
    expect(SETTINGS_MODALITIES.filter(isBeachModality)).toStrictEqual(BEACH_MODALITIES);
  });
});

describe("getMatchResults", () => {
  test("a match ended by hand before any rally keeps the teams but nobody on the court", () => {
    const timeline = CorrectionPlayer.start(matchInput(ONE_SHORT_SET))
      .run((state) => endMatchManually(state, "a"))
      .timeline();
    const [result] = getMatchResults(timeline);

    expect(result?.teams.a).toHaveLength(1);
    expect(result?.onCourt).toStrictEqual({ a: [], b: [] });
    expect(result?.points).toStrictEqual({ a: 0, b: 0 });
    expect(result?.winner).toBe("a");
  });
});

describe("getRoundSummary", () => {
  test("carries the version of the MVP formula, even for an empty round", () => {
    const summary = getRoundSummary(new CorrectionPlayer().timeline(), INDOOR);

    expect(summary.mvpFormulaVersion).toBe(MVP_FORMULA_VERSION);
    expect(summary.mvp).toBeNull();
    expect(summary.ranking).toBeNull();
  });
});

describe("MVP helpers", () => {
  test("nobody played: no MVP of the court nor of the sand", () => {
    expect(getPlayerMvp([], [])).toBeNull();
    expect(getTeamMvp([])).toBeNull();
  });

  test("a member who played no finished match has no side", () => {
    expect(getMainSide(ABSENT, [])).toBeNull();
  });
});

describe("getSideHighlights", () => {
  test("each card goes to the side ahead, or hides on a tie", () => {
    const highlights = getSideHighlights({
      a: { wins: 2, longestWinStreak: 1, currentWinStreak: 0 },
      b: { wins: 2, longestWinStreak: 2, currentWinStreak: 2 },
    });

    expect(highlights).toStrictEqual({
      mostWins: null,
      longestStreak: { side: "b", longestWinStreak: 2 },
    });
  });
});

describe("compare", () => {
  test("the first criterion that differs decides; a full tie is zero", () => {
    expect(firstDifference([0, -1, 1])).toBe(-1);
    expect(firstDifference([0, 0])).toBe(0);
  });

  test("on a tie, the earliest candidate stays", () => {
    expect(firstOf(["b", "a", "c"], () => 0)).toBe("b");
    expect(firstOf([], () => 0)).toBeNull();
  });
});
