import { readFileSync } from "node:fs";

import { describe, expect, test } from "vitest";

import { CorrectionPlayer } from "../corrections/correction-player.test.fixture.js";
import type { CourtSessionTimeline } from "../corrections/types.js";
import { AUTHORLESS_POINT_KINDS, POINT_KINDS } from "../score/constants.data.js";
import { confirmSetEnd, endMatchManually } from "../score/commands.js";
import {
  BLUE_LINEUP,
  ORANGE_LINEUP,
  rotationMatchInput,
} from "../score/match-player.test.fixture.js";
import type { FinishedMatch, MemberId, ScoringRules, TeamSide } from "../score/types.js";
import { groupByMatch, tally } from "./by-match.js";
import { CREDITED_POINT_KINDS } from "./constants.data.js";
import {
  getMembersInOrder,
  getResultsOfMatch,
  getWinStreaks,
  resultOfSide,
} from "./match-results.js";
import { getPlayerStats } from "./player-stats.js";
import { getSideStats } from "./side-stats.js";
import type { CourtBalance, PlayerStats } from "./types.js";

const ONE_SHORT_SET: ScoringRules = {
  bestOf: 1,
  pointsPerSet: 3,
  tieBreakPoints: null,
  winMargin: 2,
};
const SHORT_MD3: ScoringRules = { bestOf: 3, pointsPerSet: 3, tieBreakPoints: 3, winMargin: 2 };
const TEAM_WITH_ONE_MORE = 7;
const MIDDLE_BLOCKERS = [2, 5];
const ORANGE_SEVENTH = "a0000000-0000-4000-8000-000000000007";
const BLUE_SEVENTH = "b0000000-0000-4000-8000-000000000007";

function statsOf(timeline: CourtSessionTimeline, memberId: MemberId | undefined): PlayerStats {
  const found = getPlayerStats(timeline).find((stats) => stats.memberId === memberId);
  if (found === undefined) {
    throw new Error("member not in the stats");
  }
  return found;
}

function balanceOf(timeline: CourtSessionTimeline, memberId: MemberId | undefined): CourtBalance {
  const { pointsFor, pointsAgainst } = statsOf(timeline, memberId);
  return { pointsFor, pointsAgainst };
}

describe("constants", () => {
  test("the credited kinds are the kinds of point without the authorless ones, in order", () => {
    expect(CREDITED_POINT_KINDS).toStrictEqual(
      POINT_KINDS.filter((kind) => !AUTHORLESS_POINT_KINDS.includes(kind)),
    );
  });
});

describe("getWinStreaks", () => {
  test("Bia wins, wins, loses, wins: longest 2, current 1 (P1)", () => {
    expect(getWinStreaks(["win", "win", "loss", "win"])).toStrictEqual({
      longestWinStreak: 2,
      currentWinStreak: 1,
    });
  });

  test("a match without a winner breaks the run (P2)", () => {
    expect(getWinStreaks(["win", "win", "undecided", "win"])).toStrictEqual({
      longestWinStreak: 2,
      currentWinStreak: 1,
    });
  });

  test("no matches, no streak", () => {
    expect(getWinStreaks([])).toStrictEqual({ longestWinStreak: 0, currentWinStreak: 0 });
  });

  test("a run that lasts to the end is both the longest and the current", () => {
    expect(getWinStreaks(["loss", "win", "win", "win"])).toStrictEqual({
      longestWinStreak: 3,
      currentWinStreak: 3,
    });
  });
});

function finished(
  winner: TeamSide | null,
  a: readonly MemberId[],
  b: readonly MemberId[],
): FinishedMatch {
  return {
    completedSets: [],
    currentSet: null,
    endReason: "manual",
    formationsVersion: 1,
    matchId: "f0000000-0000-4000-8000-000000000001",
    rotations: { a: null, b: null },
    rulesVersion: 1,
    scoring: ONE_SHORT_SET,
    setsWon: { a: 0, b: 0 },
    teams: { a: { memberIds: a }, b: { memberIds: b } },
    winner,
  };
}

describe("match results", () => {
  test("the winner wins, the other side loses, and without a winner neither", () => {
    expect(resultOfSide(finished("a", [], []), "a")).toBe("win");
    expect(resultOfSide(finished("a", [], []), "b")).toBe("loss");
    expect(resultOfSide(finished(null, [], []), "a")).toBe("undecided");
    expect(resultOfSide(finished(null, [], []), "b")).toBe("undecided");
  });

  test("everyone of both teams has a result", () => {
    expect([...getResultsOfMatch(finished("b", ["a1"], ["b1", "b2"]))]).toStrictEqual([
      ["a1", "loss"],
      ["b1", "win"],
      ["b2", "win"],
    ]);
  });

  test("members come in the order they first appear, never by id", () => {
    const matches = [finished("a", ["z", "m"], ["c"]), finished("b", ["c", "a"], ["z", "b"])];

    expect(getMembersInOrder(matches)).toStrictEqual(["z", "m", "c", "a", "b"]);
  });
});

describe("groupByMatch and tally", () => {
  test("splits contiguous items by match", () => {
    const items = [
      { matchId: "m1", value: 1 },
      { matchId: "m1", value: 2 },
      { matchId: "m2", value: 3 },
    ];

    expect([...groupByMatch(items)]).toStrictEqual([
      ["m1", [items[0], items[1]]],
      ["m2", [items[2]]],
    ]);
    expect(groupByMatch([]).size).toBe(0);
  });

  test("adds up without changing what it already returned", () => {
    const counts = tally(["x", "y", "x"], (key, current: ReadonlyMap<string, number>) => [
      [key, (current.get(key) ?? 0) + 1],
    ]);

    expect([...counts]).toStrictEqual([
      ["x", 2],
      ["y", 1],
    ]);
  });
});

describe("getPlayerStats: who stood on the court", () => {
  /** A libero on the middles, Laranja in zone 6 receiving first; Azul with the rotation off. */
  function liberoMatch(): CourtSessionTimeline {
    return CorrectionPlayer.start(
      rotationMatchInput(ONE_SHORT_SET, {
        firstServer: "b",
        zones: [6, null],
        teamSize: TEAM_WITH_ONE_MORE,
        liberoIndexes: [MIDDLE_BLOCKERS, null],
      }),
    )
      .rallies("abaa")
      .run(confirmSetEnd)
      .timeline();
  }

  interface AlignmentCase {
    readonly id: string;
    readonly expected: { readonly slots: Readonly<Record<string, { readonly memberId: string }>> };
  }

  /** Who is on the court, from the golden of the libero and never from the code under test. */
  function courtFromGolden(id: string): readonly MemberId[] {
    const url = new URL("../../golden/libero-alignment.json", import.meta.url);
    const cases = JSON.parse(readFileSync(url, "utf8")) as readonly AlignmentCase[];
    const found = cases.find((alignment) => alignment.id === id);
    if (found === undefined) {
      throw new Error(`missing alignment ${id}`);
    }
    return Object.values(found.expected.slots).map(({ memberId }) => memberId);
  }

  test("the libero counts only in the rallies the alignment puts it on the court", () => {
    // Side-out in zone 6, a point lost serving in zone 5, a side-out in zone 5, a point served in
    // zone 4: the court before each point, never the one after the side-out.
    const rallies: readonly { readonly court: string; readonly won: boolean }[] = [
      { court: "5x1-middles-zone-6-receiving", won: true },
      { court: "5x1-middles-zone-5-serving", won: false },
      { court: "5x1-middles-zone-5-receiving", won: true },
      { court: "5x1-middles-zone-4-serving", won: true },
    ];
    const expectedOf = (memberId: MemberId): CourtBalance => {
      const onCourt = rallies.filter(({ court }) => courtFromGolden(court).includes(memberId));
      return {
        pointsFor: onCourt.filter(({ won }) => won).length,
        pointsAgainst: onCourt.filter(({ won }) => !won).length,
      };
    };
    const timeline = liberoMatch();

    for (const memberId of [...ORANGE_LINEUP, ORANGE_SEVENTH]) {
      expect(balanceOf(timeline, memberId)).toStrictEqual(expectedOf(memberId));
    }
    // Checked by hand too: the libero misses only the point served in zone 5.
    expect(balanceOf(timeline, ORANGE_SEVENTH)).toStrictEqual({ pointsFor: 3, pointsAgainst: 0 });
    expect(balanceOf(timeline, ORANGE_LINEUP[2])).toStrictEqual({ pointsFor: 1, pointsAgainst: 1 });
  });

  test("with the rotation off, the whole team stood on the court", () => {
    const timeline = liberoMatch();

    for (const memberId of [...BLUE_LINEUP, BLUE_SEVENTH]) {
      expect(balanceOf(timeline, memberId)).toStrictEqual({ pointsFor: 1, pointsAgainst: 3 });
    }
  });

  test("the bench that never came in wins the match with a zero balance", () => {
    const timeline = CorrectionPlayer.start(
      rotationMatchInput(ONE_SHORT_SET, { teamSize: TEAM_WITH_ONE_MORE, zones: [1, 1] }),
    )
      .rallies("aaa")
      .run(confirmSetEnd)
      .timeline();

    expect(statsOf(timeline, ORANGE_SEVENTH)).toMatchObject({
      matchesPlayed: 1,
      wins: 1,
      pointsFor: 0,
      pointsAgainst: 0,
      plusMinus: 0,
      longestWinStreak: 1,
      currentWinStreak: 1,
    });
    expect(statsOf(timeline, BLUE_SEVENTH)).toMatchObject({ losses: 1, plusMinus: 0 });
  });
});

describe("getPlayerStats: which matches count", () => {
  test("an empty round has no statistics", () => {
    const empty: CourtSessionTimeline = { entries: [] };

    expect(getPlayerStats(empty)).toStrictEqual([]);
    expect(getSideStats(empty)).toStrictEqual({
      a: { wins: 0, longestWinStreak: 0, currentWinStreak: 0 },
      b: { wins: 0, longestWinStreak: 0, currentWinStreak: 0 },
    });
  });

  test("the open match counts nothing until it ends", () => {
    const open = CorrectionPlayer.start(rotationMatchInput(ONE_SHORT_SET)).rallies("ab");

    expect(getPlayerStats(open.timeline())).toStrictEqual([]);
    expect(getPlayerStats(open.rallies("aa").run(confirmSetEnd).timeline())).toHaveLength(
      ORANGE_LINEUP.length + BLUE_LINEUP.length,
    );
  });

  test("points after the last set and before a manual end with a winner count", () => {
    const timeline = CorrectionPlayer.start(rotationMatchInput(SHORT_MD3))
      .rallies("aaa")
      .run(confirmSetEnd)
      .rallies("bb")
      .run((state) => endMatchManually(state, "b"))
      .timeline();

    expect(statsOf(timeline, ORANGE_LINEUP[0])).toMatchObject({
      losses: 1,
      pointsFor: 3,
      pointsAgainst: 2,
      plusMinus: 1,
    });
    expect(statsOf(timeline, BLUE_LINEUP[0])).toMatchObject({ wins: 1, results: ["win"] });
  });

  test("a manual end without a winner is undecided, neither a win nor a loss", () => {
    const timeline = CorrectionPlayer.start(rotationMatchInput(ONE_SHORT_SET))
      .rallies("ab")
      .run((state) => endMatchManually(state, null))
      .timeline();

    expect(statsOf(timeline, ORANGE_LINEUP[0])).toMatchObject({
      matchesPlayed: 1,
      wins: 0,
      losses: 0,
      undecided: 1,
      results: ["undecided"],
      plusMinus: 0,
    });
  });
});
