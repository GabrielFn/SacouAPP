import type { MemberId, TeamSide } from "../score/types.js";
import { firstDifference, firstOf } from "./compare.js";
import type { BeachTeamStanding, DayMvp, FinishedMatchResult, PlayerStats } from "./types.js";

/**
 * Formula 1 (question 97): the best balance; then the best share of wins, compared as integers
 * (`w1 × m2` against `w2 × m1`, so 2 of 3 ties with 4 of 6); then the longest run of wins; then more
 * matches. A full tie keeps the order of the first appearance, never the IDs.
 */
function compareCandidates(x: PlayerStats, y: PlayerStats): number {
  return firstDifference([
    y.plusMinus - x.plusMinus,
    y.wins * x.matchesPlayed - x.wins * y.matchesPlayed,
    y.longestWinStreak - x.longestWinStreak,
    y.matchesPlayed - x.matchesPlayed,
  ]);
}

/** The sides a member played, one per finished match, in order. */
function sidesOf(
  memberId: MemberId,
  finishedMatches: readonly FinishedMatchResult[],
): readonly TeamSide[] {
  return finishedMatches.flatMap(({ teams }) => {
    if (teams.a.includes(memberId)) {
      return ["a"];
    }
    return teams.b.includes(memberId) ? ["b"] : [];
  });
}

/** The side the member played the most matches on; on a tie, the side of their last match. */
export function getMainSide(
  memberId: MemberId,
  finishedMatches: readonly FinishedMatchResult[],
): TeamSide | null {
  const sides = sidesOf(memberId, finishedMatches);
  const onA = sides.filter((side) => side === "a").length;
  const onB = sides.length - onA;
  if (onA === onB) {
    return sides.at(-1) ?? null;
  }
  return onA > onB ? "a" : "b";
}

/** The MVP of the court: the best player by formula 1, on the side they played the most. */
export function getPlayerMvp(
  players: readonly PlayerStats[],
  finishedMatches: readonly FinishedMatchResult[],
): DayMvp | null {
  const best = firstOf(
    players.filter(({ matchesPlayed }) => matchesPlayed > 0),
    compareCandidates,
  );
  if (best === null) {
    return null;
  }
  return {
    kind: "player",
    memberIds: [best.memberId],
    side: getMainSide(best.memberId, finishedMatches),
    matchesPlayed: best.matchesPlayed,
    wins: best.wins,
    plusMinus: best.plusMinus,
    longestWinStreak: best.longestWinStreak,
  };
}

/** The MVP of the sand: the pair or the four first on the ranking of the day, without a side. */
export function getTeamMvp(ranking: readonly BeachTeamStanding[]): DayMvp | null {
  const [first] = ranking;
  if (first === undefined) {
    return null;
  }
  return {
    kind: "team",
    memberIds: first.memberIds,
    side: null,
    matchesPlayed: first.wins + first.losses + first.undecided,
    wins: first.wins,
    plusMinus: first.pointsFor - first.pointsAgainst,
    longestWinStreak: first.longestWinStreak,
  };
}
