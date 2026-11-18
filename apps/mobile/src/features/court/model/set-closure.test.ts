import type { MatchScore, MatchSet } from "@sacou/match-engine";
import { beforeAll, describe, expect, test } from "vitest";

import { stateOfTimeline } from "./court-screen.selectors";
import { startScenario } from "./screen-scenarios.test.fixture";
import { confirmingClosesMatch, decidedSetClosesMatch, decidedSetWinner } from "./set-closure";

type BestOf = MatchScore["scoring"]["bestOf"];
type Points = MatchSet["score"];

const SET_POINTS = 25;
const TIE_BREAK_POINTS = 15;
const BEST_OF_THREE: BestOf = 3;
const BEST_OF_FIVE: BestOf = 5;

let base: MatchScore;
let baseSet: MatchSet;

beforeAll(async () => {
  const scenario = await startScenario();
  const { currentMatch } = stateOfTimeline(scenario.timeline());
  if (currentMatch === null || currentMatch.currentSet === null) throw new Error("no open set");
  base = currentMatch;
  baseSet = currentMatch.currentSet;
});

/** A real engine match with the sets, rules and current set replaced, so the types stay checked. */
function matchAt(
  setsWon: MatchScore["setsWon"],
  set: Pick<MatchSet, "setNumber" | "score" | "targetPoints">,
  bestOf: BestOf,
): MatchScore {
  return {
    ...base,
    setsWon,
    scoring: { ...base.scoring, bestOf, winMargin: 2 },
    currentSet: { ...baseSet, ...set, servingTeam: "a" },
  };
}

function matchWith(
  setsWon: MatchScore["setsWon"],
  score: Points,
  bestOf: BestOf = BEST_OF_THREE,
): MatchScore {
  return matchAt(setsWon, { setNumber: 1, score, targetPoints: SET_POINTS }, bestOf);
}

describe("set closure", () => {
  test("a decided set that takes the last set needed closes the match", () => {
    const match = matchWith({ a: 1, b: 0 }, { a: 25, b: 20 });
    expect(decidedSetWinner(match)).toBe("a");
    expect(decidedSetClosesMatch(match)).toBe(true);
    expect(confirmingClosesMatch(match, "b")).toBe(false);
  });

  test("a decided set in a series that goes on does not close it", () => {
    expect(decidedSetClosesMatch(matchWith({ a: 0, b: 0 }, { a: 25, b: 20 }))).toBe(false);
  });

  test("the winner is the one the engine says, not whoever is ahead", () => {
    const match = matchWith({ a: 1, b: 1 }, { a: 25, b: 24 }, BEST_OF_FIVE);
    expect(decidedSetWinner(match)).toBeNull();
    expect(decidedSetClosesMatch(match)).toBe(false);
  });
});

function tieBreakMatch(score: Points, bestOf: BestOf = BEST_OF_THREE): MatchScore {
  const sets = Math.floor(bestOf / 2);
  return matchAt(
    { a: sets, b: sets },
    { setNumber: bestOf, score, targetPoints: TIE_BREAK_POINTS },
    bestOf,
  );
}

describe("set closure in the tie-break (target 15)", () => {
  test("15-14 is not decided; 16-14 is, and closes the match", () => {
    expect(decidedSetWinner(tieBreakMatch({ a: 15, b: 14 }))).toBeNull();
    expect(decidedSetWinner(tieBreakMatch({ a: 14, b: 16 }))).toBe("b");
    expect(decidedSetClosesMatch(tieBreakMatch({ a: 14, b: 16 }))).toBe(true);
  });

  test("15-13 decides it, and 25 points do not matter when the target is 15", () => {
    expect(decidedSetWinner(tieBreakMatch({ a: 15, b: 13 }))).toBe("a");
    expect(decidedSetWinner(tieBreakMatch({ a: 24, b: 14 }))).toBe("a");
  });

  test("best of five: only the third set won closes it; the match with no current set decides nothing", () => {
    const two = { a: 2, b: 0 };
    const third: MatchScore = { ...tieBreakMatch({ a: 25, b: 10 }, BEST_OF_FIVE), setsWon: two };
    expect(confirmingClosesMatch(third, "a")).toBe(true);
    expect(confirmingClosesMatch({ ...third, setsWon: { a: 1, b: 2 } }, "a")).toBe(false);
    expect(decidedSetWinner({ ...third, currentSet: null })).toBeNull();
    expect(decidedSetClosesMatch({ ...third, currentSet: null })).toBe(false);
  });
});
