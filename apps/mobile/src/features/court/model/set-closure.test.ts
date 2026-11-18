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
