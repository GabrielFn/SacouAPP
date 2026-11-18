import { describe, expect, test } from "vitest";
import type { MatchScore } from "@sacou/match-engine";

import { confirmingClosesMatch, decidedSetClosesMatch, decidedSetWinner } from "./set-closure";

function matchWith(
  setsWon: { a: number; b: number },
  score: { a: number; b: number },
  bestOf = 3,
): MatchScore {
  return {
    setsWon,
    scoring: { bestOf, winMargin: 2 },
    currentSet: { setNumber: 1, score, targetPoints: 25, servingTeam: "a" },
  } as unknown as MatchScore;
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
    const match = matchWith({ a: 1, b: 1 }, { a: 25, b: 24 }, 5);
    expect(decidedSetWinner(match)).toBeNull();
    expect(decidedSetClosesMatch(match)).toBe(false);
  });
});

function tieBreakMatch(score: { a: number; b: number }, bestOf = 3): MatchScore {
  const sets = Math.floor(bestOf / 2);
  return {
    setsWon: { a: sets, b: sets },
    scoring: { bestOf, winMargin: 2 },
    currentSet: { setNumber: bestOf, score, targetPoints: 15, servingTeam: "a" },
  } as unknown as MatchScore;
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
    const third = {
      ...tieBreakMatch({ a: 25, b: 10 }, 5),
      setsWon: two,
    } as unknown as MatchScore;
    expect(confirmingClosesMatch(third, "a")).toBe(true);
    expect(confirmingClosesMatch({ ...third, setsWon: { a: 1, b: 2 } }, "a")).toBe(false);
    expect(decidedSetWinner({ ...third, currentSet: null })).toBeNull();
    expect(decidedSetClosesMatch({ ...third, currentSet: null })).toBe(false);
  });
});
