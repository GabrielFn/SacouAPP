import type { CourtSessionTimeline } from "../corrections/types.js";
import type { MemberId } from "../score/types.js";
import { getMembersInOrder, getResultsOfMatch, getWinStreaks } from "./match-results.js";
import { NO_POINTS, getPointsByMatch } from "./points-by-kind.js";
import { NO_BALANCE, getCourtBalancesByMatch } from "./rally-balance.js";
import type { CourtBalance, MatchResult, PlayerStats, PointsByKind } from "./types.js";

/** What a finished match gave each member who played it. */
interface MatchTally {
  readonly results: ReadonlyMap<MemberId, MatchResult>;
  readonly balances: ReadonlyMap<MemberId, CourtBalance>;
  readonly points: ReadonlyMap<MemberId, PointsByKind>;
}

/** A member's share of one match: the result, the court balance and the points scored. */
interface MatchShare {
  readonly result: MatchResult;
  readonly balance: CourtBalance;
  readonly points: PointsByKind;
}

function countOf(results: readonly MatchResult[], wanted: MatchResult): number {
  return results.filter((result) => result === wanted).length;
}

function sharesOf(memberId: MemberId, tallies: readonly MatchTally[]): readonly MatchShare[] {
  return tallies.flatMap(({ results, balances, points }) => {
    const result = results.get(memberId);
    return result === undefined
      ? []
      : [
          {
            result,
            balance: balances.get(memberId) ?? NO_BALANCE,
            points: points.get(memberId) ?? NO_POINTS,
          },
        ];
  });
}

function addPoints(total: PointsByKind, points: PointsByKind): PointsByKind {
  return {
    attack: total.attack + points.attack,
    block: total.block + points.block,
    ace: total.ace + points.ace,
    other: total.other + points.other,
  };
}

function toPlayerStats(memberId: MemberId, shares: readonly MatchShare[]): PlayerStats {
  const results = shares.map(({ result }) => result);
  const pointsFor = shares.reduce((sum, { balance }) => sum + balance.pointsFor, 0);
  const pointsAgainst = shares.reduce((sum, { balance }) => sum + balance.pointsAgainst, 0);
  const { longestWinStreak, currentWinStreak } = getWinStreaks(results);
  return {
    memberId,
    matchesPlayed: results.length,
    wins: countOf(results, "win"),
    losses: countOf(results, "loss"),
    undecided: countOf(results, "undecided"),
    pointsFor,
    pointsAgainst,
    plusMinus: pointsFor - pointsAgainst,
    longestWinStreak,
    currentWinStreak,
    results,
    pointsByKind: shares.reduce((total, { points }) => addPoints(total, points), NO_POINTS),
  };
}

/**
 * The statistics of each member who played a finished match of the court session: matches, wins,
 * losses and matches without a winner; points for and against while on the court, and the +/−;
 * wins in a row; points scored by kind. Computed from the timeline alone, never recorded; the open
 * match counts nothing until it ends (ADR 0032). Members come in the order they first appear.
 */
export function getPlayerStats(timeline: CourtSessionTimeline): readonly PlayerStats[] {
  const finishedMatches = timeline.entries.at(-1)?.state.finishedMatches ?? [];
  const balancesByMatch = getCourtBalancesByMatch(timeline);
  const pointsByMatch = getPointsByMatch(timeline);
  const tallies = finishedMatches.map((match): MatchTally => ({
    results: getResultsOfMatch(match),
    balances: balancesByMatch.get(match.matchId) ?? new Map(),
    points: pointsByMatch.get(match.matchId) ?? new Map(),
  }));
  return getMembersInOrder(finishedMatches).map((memberId) =>
    toPlayerStats(memberId, sharesOf(memberId, tallies)),
  );
}
