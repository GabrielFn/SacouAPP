import { FORMATION_CATALOG_VERSION } from "@sacou/volley-rules";
import { describe, expect, test } from "vitest";

import { attributePoint } from "../attributions/commands.js";
import type { PointAuthorship } from "../attributions/types.js";
import { revertToEvent } from "../corrections/commands.js";
import { CorrectionPlayer } from "../corrections/correction-player.test.fixture.js";
import {
  confirmSetEnd,
  endMatchManually,
  startMatch,
  substitutePlayer,
} from "../score/commands.js";
import type {
  MatchStartedPayload,
  MemberId,
  ScoringRules,
  TeamRoster,
  TeamSide,
  TeamState,
} from "../score/types.js";
import { getPlayerStats } from "./player-stats.js";
import { getSideStats } from "./side-stats.js";
import type { MatchResult, PlayerStats, PointsByKind } from "./types.js";

/** One set of three points per match, as in the round of the plan. */
const ONE_SHORT_SET: ScoringRules = {
  bestOf: 1,
  pointsPerSet: 3,
  tieBreakPoints: null,
  winMargin: 2,
};
const ID_DIGITS = 12;

function member(prefix: string, number: number): MemberId {
  return `${prefix}000000-0000-4000-8000-${String(number).padStart(ID_DIGITS, "0")}`;
}

function membersOf(prefix: string, count: number): readonly MemberId[] {
  return Array.from({ length: count }, (_, index) => member(prefix, index + 1));
}

const ORANGE = membersOf("a1", 7);
const [A1, A2, A3, A4, A5, A6, A7] = ORANGE;
const BLUE = membersOf("b1", 6);
const GREEN = membersOf("c1", 6);
const [B1, B2, B3, , B5] = BLUE;
const [C1] = GREEN;

function required(id: MemberId | undefined): MemberId {
  if (id === undefined) {
    throw new Error("missing member");
  }
  return id;
}

/** Laranja plays a 5x1 in zone 1 without a libero; the members after the six are on the bench. */
function orangeRotation(lineup: readonly MemberId[], bench: readonly MemberId[]): TeamState {
  return { bench, libero: null, lineup, setterZone: 1, system: "5x1" };
}

const ORANGE_FIRST_LINEUP = ORANGE.slice(0, 6);
const ORANGE_WITH_THE_SEVENTH = [...ORANGE.slice(0, 5), required(A7)];

function matchOf(
  matchNumber: number,
  teams: { readonly a: TeamRoster; readonly b: TeamRoster },
  rotations: { readonly a: TeamState | null; readonly b: TeamState | null },
  waiting: readonly MemberId[],
): MatchStartedPayload {
  return {
    firstServer: "a",
    formationsVersion: FORMATION_CATALOG_VERSION,
    matchId: `f0000000-0000-4000-8000-${String(matchNumber).padStart(ID_DIGITS, "0")}`,
    queue: { players: [], teams: [{ memberIds: waiting }] },
    rotations,
    rulesVersion: 1,
    scoring: ONE_SHORT_SET,
    teams,
  };
}

function answer(
  player: CorrectionPlayer,
  pointEventId: string,
  authorship: PointAuthorship,
): CorrectionPlayer {
  const result = attributePoint(player.timeline(), pointEventId, authorship);
  if (!result.ok) {
    throw new Error(`refused: ${result.error.code}`);
  }
  return result.value.reduce<CorrectionPlayer>((current, draft) => current.append(draft), player);
}

/** A point of `team`, then each answer to "De quem foi?" about it, in order: the last one wins. */
function scoredBy(
  player: CorrectionPlayer,
  team: TeamSide,
  ...authorships: readonly PointAuthorship[]
): CorrectionPlayer {
  const scored = player.point(team);
  const pointEventId = scored.last.eventId;
  return authorships.reduce(
    (current, authorship) => answer(current, pointEventId, authorship),
    scored,
  );
}

function attack(author: MemberId | undefined): PointAuthorship {
  return { kind: "attack", author: required(author) };
}

const OPPONENT_ERROR: PointAuthorship = { kind: "opponent-error", author: null };

/**
 * The round of the plan, played with the real commands. M1 Laranja × Azul, M2 Laranja × Verde with
 * a7 in for a6 and a reverted point, M3 Laranja × Azul with Azul winning, M4 Verde × Azul ended by
 * hand without a winner, M5 Verde × Azul still open.
 */
function playTheRound(): CorrectionPlayer {
  const m1 = CorrectionPlayer.start(
    matchOf(
      1,
      { a: { memberIds: ORANGE }, b: { memberIds: BLUE } },
      { a: orangeRotation(ORANGE_FIRST_LINEUP, [required(A7)]), b: null },
      GREEN,
    ),
  );
  const m1Played = scoredBy(
    scoredBy(
      scoredBy(scoredBy(m1, "a", attack(A3), attack(A2)), "a", OPPONENT_ERROR),
      "b",
      attack(B3),
    ),
    "a",
    { kind: "block", author: required(A4) },
  ).run(confirmSetEnd);

  const m2 = m1Played
    .run((state) =>
      startMatch(
        state,
        matchOf(
          2,
          { a: { memberIds: ORANGE }, b: { memberIds: GREEN } },
          { a: orangeRotation(ORANGE_FIRST_LINEUP, [required(A7)]), b: null },
          BLUE,
        ),
      ),
    )
    .run((state) => substitutePlayer(state, "a", required(A6), required(A7)));
  const upToTheThirdPoint = m2.rallies("ab");
  const withC1 = answer(upToTheThirdPoint, upToTheThirdPoint.last.eventId, attack(C1)).point("a");
  const thirdPoint = withC1.last;
  const withRevertedPoint = scoredBy(withC1, "a", attack(A1)).correct((timeline) =>
    revertToEvent(timeline, thirdPoint.eventId),
  );
  const m2Played = withRevertedPoint.point("a").run(confirmSetEnd);

  const m3Played = m2Played
    .run((state) =>
      startMatch(
        state,
        matchOf(
          3,
          { a: { memberIds: ORANGE }, b: { memberIds: BLUE } },
          { a: orangeRotation(ORANGE_WITH_THE_SEVENTH, [required(A6)]), b: null },
          GREEN,
        ),
      ),
    )
    .rallies("bbab")
    .run(confirmSetEnd);

  const m4Played = scoredBy(
    m3Played
      .run((state) =>
        startMatch(
          state,
          matchOf(
            4,
            { a: { memberIds: GREEN }, b: { memberIds: BLUE } },
            { a: null, b: null },
            ORANGE,
          ),
        ),
      )
      .point("a"),
    "b",
    { kind: "other", author: required(B2) },
  ).run((state) => endMatchManually(state, null));

  return scoredBy(
    m4Played.run((state) =>
      startMatch(
        state,
        matchOf(
          5,
          { a: { memberIds: GREEN }, b: { memberIds: BLUE } },
          { a: null, b: null },
          ORANGE,
        ),
      ),
    ),
    "b",
    attack(B5),
  );
}

const NO_POINTS: PointsByKind = { attack: 0, block: 0, ace: 0, other: 0 };

interface Row {
  readonly results: readonly MatchResult[];
  readonly pointsFor: number;
  readonly pointsAgainst: number;
  readonly longestWinStreak: number;
  readonly currentWinStreak: number;
  readonly pointsByKind?: Partial<PointsByKind>;
}

/** A row of the table of the plan, with the counts written by hand next to the results. */
function row(
  memberId: MemberId | undefined,
  counts: Row,
  wins: number,
  losses: number,
  undecided: number,
): PlayerStats {
  return {
    memberId: required(memberId),
    matchesPlayed: counts.results.length,
    wins,
    losses,
    undecided,
    pointsFor: counts.pointsFor,
    pointsAgainst: counts.pointsAgainst,
    plusMinus: counts.pointsFor - counts.pointsAgainst,
    longestWinStreak: counts.longestWinStreak,
    currentWinStreak: counts.currentWinStreak,
    results: counts.results,
    pointsByKind: { ...NO_POINTS, ...counts.pointsByKind },
  };
}

const ORANGE_RESULTS: readonly MatchResult[] = ["win", "win", "loss"];
const BLUE_RESULTS: readonly MatchResult[] = ["loss", "win", "undecided"];
const GREEN_RESULTS: readonly MatchResult[] = ["loss", "undecided"];

function orangeStarter(
  memberId: MemberId | undefined,
  points?: Partial<PointsByKind>,
): PlayerStats {
  const counts = {
    results: ORANGE_RESULTS,
    pointsFor: 7,
    pointsAgainst: 5,
    longestWinStreak: 2,
    currentWinStreak: 0,
  };
  return row(
    memberId,
    { ...counts, ...(points === undefined ? {} : { pointsByKind: points }) },
    2,
    1,
    0,
  );
}

function blue(memberId: MemberId | undefined, points?: Partial<PointsByKind>): PlayerStats {
  const counts = {
    results: BLUE_RESULTS,
    pointsFor: 5,
    pointsAgainst: 5,
    longestWinStreak: 1,
    currentWinStreak: 0,
  };
  return row(
    memberId,
    { ...counts, ...(points === undefined ? {} : { pointsByKind: points }) },
    1,
    1,
    1,
  );
}

function green(memberId: MemberId | undefined, points?: Partial<PointsByKind>): PlayerStats {
  const counts = {
    results: GREEN_RESULTS,
    pointsFor: 2,
    pointsAgainst: 4,
    longestWinStreak: 0,
    currentWinStreak: 0,
  };
  return row(
    memberId,
    { ...counts, ...(points === undefined ? {} : { pointsByKind: points }) },
    0,
    1,
    1,
  );
}

/** The table of the plan, checked by hand, in the order the members first appear. */
const EXPECTED_ROUND: readonly PlayerStats[] = [
  orangeStarter(A1),
  orangeStarter(A2, { attack: 1 }),
  orangeStarter(A3),
  orangeStarter(A4, { block: 1 }),
  orangeStarter(A5),
  row(
    A6,
    {
      results: ORANGE_RESULTS,
      pointsFor: 3,
      pointsAgainst: 1,
      longestWinStreak: 2,
      currentWinStreak: 0,
    },
    2,
    1,
    0,
  ),
  row(
    A7,
    {
      results: ORANGE_RESULTS,
      pointsFor: 4,
      pointsAgainst: 4,
      longestWinStreak: 2,
      currentWinStreak: 0,
    },
    2,
    1,
    0,
  ),
  blue(B1),
  blue(B2, { other: 1 }),
  blue(B3, { attack: 1 }),
  blue(BLUE[3]),
  blue(B5),
  blue(BLUE[5]),
  green(C1, { attack: 1 }),
  ...GREEN.slice(1).map((id) => green(id)),
];

describe("acceptance: the simulated round of the plan, checked by hand", () => {
  const timeline = playTheRound().timeline();
  const stats = getPlayerStats(timeline);

  test("every member, in the order they first appear", () => {
    expect(stats).toStrictEqual(EXPECTED_ROUND);
    expect(stats.map(({ memberId }) => memberId)).toStrictEqual([...ORANGE, ...BLUE, ...GREEN]);
  });

  test("the +/− of the round adds up to zero", () => {
    expect(stats.reduce((sum, { plusMinus }) => sum + plusMinus, 0)).toBe(0);
  });

  test("a match without a winner breaks the streak: Azul ends the round with none", () => {
    expect(stats.find(({ memberId }) => memberId === B1)?.currentWinStreak).toBe(0);
  });

  test("the sides: Laranja won twice in a row on side a, Azul once on side b", () => {
    expect(getSideStats(timeline)).toStrictEqual({
      a: { wins: 2, longestWinStreak: 2, currentWinStreak: 0 },
      b: { wins: 1, longestWinStreak: 1, currentWinStreak: 0 },
    });
  });
});
