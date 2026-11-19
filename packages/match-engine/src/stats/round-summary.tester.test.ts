import { describe, expect, test } from "vitest";

import { getBeachRanking } from "./beach-ranking.js";
import { getMainSide, getPlayerMvp } from "./mvp.js";
import { getRoundSummary } from "./round-summary.js";
import { getSideHighlights } from "./side-highlights.js";
import { CorrectionPlayer } from "../corrections/correction-player.test.fixture.js";
import { NO_POINTS } from "./points-by-kind.js";
import type { FinishedMatchResult, PlayerStats } from "./types.js";

const [P1, P2, P3, P4] = ["p1", "p2", "p3", "p4"];
const OPTIONS = {
  modality: "indoor-6x6",
  mvpEnabled: true,
  mvpByStats: true,
  individualPoints: true,
} as const;

function stats(memberId: string, over: Partial<PlayerStats>): PlayerStats {
  return {
    memberId,
    matchesPlayed: 1,
    wins: 0,
    losses: 0,
    undecided: 0,
    pointsFor: 0,
    pointsAgainst: 0,
    plusMinus: 0,
    longestWinStreak: 0,
    currentWinStreak: 0,
    results: [],
    pointsByKind: NO_POINTS,
    ...over,
  };
}

function match(
  id: string,
  a: string[],
  b: string[],
  winner: "a" | "b" | null,
  pa = 0,
  pb = 0,
): FinishedMatchResult {
  return {
    matchId: id,
    winner,
    teams: { a, b },
    onCourt: { a, b },
    points: { a: pa, b: pb },
  };
}

describe("MVP formula 1 tie-breaks", () => {
  test("balance beats everything", () => {
    const mvp = getPlayerMvp(
      [
        stats(P1, { plusMinus: 3, wins: 0 }),
        stats(P2, { plusMinus: 4, wins: 1, matchesPlayed: 9 }),
      ],
      [],
    );
    expect(mvp?.memberIds).toStrictEqual([P2]);
  });

  test("2 of 3 ties with 4 of 6 on win share, then streak decides", () => {
    const x = stats(P1, { wins: 2, matchesPlayed: 3, longestWinStreak: 1 });
    const y = stats(P2, { wins: 4, matchesPlayed: 6, longestWinStreak: 2 });
    expect(getPlayerMvp([x, y], [])?.memberIds).toStrictEqual([P2]);
    expect(getPlayerMvp([y, x], [])?.memberIds).toStrictEqual([P2]);
  });

  test("better share wins over streak and matches", () => {
    const x = stats(P1, { wins: 3, matchesPlayed: 4, longestWinStreak: 1 });
    const y = stats(P2, { wins: 2, matchesPlayed: 3, longestWinStreak: 9 });
    expect(getPlayerMvp([y, x], [])?.memberIds).toStrictEqual([P1]);
  });

  test("then more matches, then first appearance (not id order)", () => {
    const few = stats(P1, { matchesPlayed: 1 });
    const many = stats(P2, { matchesPlayed: 2 });
    expect(getPlayerMvp([few, many], [])?.memberIds).toStrictEqual([P2]);
    const late = stats("a-first-id", {});
    const early = stats("z-last-id", {});
    expect(getPlayerMvp([early, late], [])?.memberIds).toStrictEqual(["z-last-id"]);
  });

  test("players with no match are ignored", () => {
    const ghost = stats(P1, { matchesPlayed: 0, plusMinus: 99 });
    expect(getPlayerMvp([ghost], [])).toBeNull();
  });
});

describe("main side", () => {
  test("most matches wins; tie goes to the last match", () => {
    const ms = [
      match("1", [P1], [P2], "a"),
      match("2", [P2], [P1], "a"),
      match("3", [P1], [P2], "a"),
    ];
    expect(getMainSide(P1, ms)).toBe("a");
    expect(getMainSide(P2, ms)).toBe("b");
    expect(getMainSide(P1, ms.slice(0, 2))).toBe("b");
    expect(getMainSide(P2, ms.slice(0, 2))).toBe("a");
  });
});

describe("beach ranking", () => {
  test("a match without winner is neither win nor loss and breaks the streak", () => {
    const r = getBeachRanking([
      match("1", [P1, P2], [P3, P4], "a", 5, 3),
      match("2", [P2, P1], [P3, P4], null, 1, 1),
      match("3", [P1, P2], [P3, P4], "a", 5, 0),
    ]);
    const first = r[0];
    expect(first?.memberIds).toStrictEqual([P1, P2]);
    expect(first).toMatchObject({
      wins: 2,
      losses: 0,
      undecided: 1,
      longestWinStreak: 1,
      pointsFor: 11,
      pointsAgainst: 4,
    });
    expect(r[1]).toMatchObject({ wins: 0, losses: 2, undecided: 1 });
  });

  test("a remade pair is another team; full tie keeps first match order", () => {
    const r = getBeachRanking([
      match("1", [P4, P3], [P2, P1], "a"),
      match("2", [P1, P3], [P2, P4], "b"),
    ]);
    expect(r).toHaveLength(4);
    expect(r[0]?.memberIds).toStrictEqual([P4, P3]);
    expect(r[1]?.memberIds).toStrictEqual([P2, P4]);
  });

  test("fewer losses and point balance break ties in order", () => {
    const r = getBeachRanking([
      match("1", [P1, P2], [P3, P4], "a", 5, 4),
      match("2", [P3, P4], [P1, P2], "a", 9, 0),
    ]);
    expect(r[0]).toMatchObject({ wins: 1, losses: 1, pointsFor: 13 });
    expect(r[0]?.memberIds).toStrictEqual([P3, P4]);
  });

  test("empty", () => {
    expect(getBeachRanking([])).toStrictEqual([]);
  });
});

describe("side highlights", () => {
  test("side a ahead and b ahead", () => {
    const h = getSideHighlights({
      a: { wins: 3, longestWinStreak: 1, currentWinStreak: 0 },
      b: { wins: 1, longestWinStreak: 1, currentWinStreak: 0 },
    });
    expect(h).toStrictEqual({ mostWins: { side: "a", wins: 3 }, longestStreak: null });
  });
});

describe("summary switches", () => {
  test("mvp off by either flag; sand gives a ranking and a team MVP, court does not", () => {
    const t = new CorrectionPlayer().timeline();
    expect(getRoundSummary(t, { ...OPTIONS, mvpEnabled: false }).mvp).toBeNull();
    expect(getRoundSummary(t, { ...OPTIONS, mvpByStats: false }).mvp).toBeNull();
    expect(getRoundSummary(t, { ...OPTIONS, modality: "beach-2x2" }).ranking).toStrictEqual([]);
    expect(getRoundSummary(t, OPTIONS).ranking).toBeNull();
  });
});
