import { TEAM_SIDES } from "../score/constants.data.js";
import type { MemberId, TeamSide } from "../score/types.js";
import { firstDifference } from "./compare.js";
import { getWinStreaks, resultOfSide } from "./match-results.js";
import type { BeachTeamStanding, FinishedMatchResult, MatchResult } from "./types.js";

/** How one match went for a team of the sand. */
interface TeamMatch {
  readonly key: string;
  readonly memberIds: readonly MemberId[];
  readonly result: MatchResult;
  readonly pointsFor: number;
  readonly pointsAgainst: number;
}

/**
 * The same members in any order are the same team: the IDs sorted in ordinal order only to compare,
 * never to show (ADR 0048).
 */
function teamKeyOf(memberIds: readonly MemberId[]): string {
  return [...memberIds].sort().join(" ");
}

function teamMatchesOf(match: FinishedMatchResult): readonly TeamMatch[] {
  return TEAM_SIDES.map((side) => {
    const other: TeamSide = side === "a" ? "b" : "a";
    return {
      key: teamKeyOf(match.teams[side]),
      memberIds: match.teams[side],
      result: resultOfSide(match, side),
      pointsFor: match.points[side],
      pointsAgainst: match.points[other],
    };
  });
}

function countOf(results: readonly MatchResult[], wanted: MatchResult): number {
  return results.filter((result) => result === wanted).length;
}

/** A team from its matches, the first one giving the order of its members. */
function standingOf(matches: readonly TeamMatch[]): BeachTeamStanding {
  const results = matches.map(({ result }) => result);
  return {
    memberIds: matches[0]?.memberIds ?? [],
    wins: countOf(results, "win"),
    losses: countOf(results, "loss"),
    undecided: countOf(results, "undecided"),
    longestWinStreak: getWinStreaks(results).longestWinStreak,
    pointsFor: matches.reduce((sum, { pointsFor }) => sum + pointsFor, 0),
    pointsAgainst: matches.reduce((sum, { pointsAgainst }) => sum + pointsAgainst, 0),
  };
}

function pointBalanceOf({ pointsFor, pointsAgainst }: BeachTeamStanding): number {
  return pointsFor - pointsAgainst;
}

/** More wins; fewer losses; the longest run; the best balance of points (E3.9, 3.3). */
function compareStandings(x: BeachTeamStanding, y: BeachTeamStanding): number {
  return firstDifference([
    y.wins - x.wins,
    x.losses - y.losses,
    y.longestWinStreak - x.longestWinStreak,
    pointBalanceOf(y) - pointBalanceOf(x),
  ]);
}

/**
 * The ranking of the day on the sand (ADR 0048): each pair or four that played a finished match,
 * best first. A team remade with another partner is another team. Teams that tie on every criterion
 * keep the order of their first match (`a`, then `b`), never the order of the IDs.
 */
export function getBeachRanking(
  finishedMatches: readonly FinishedMatchResult[],
): readonly BeachTeamStanding[] {
  const teamMatches = finishedMatches.flatMap(teamMatchesOf);
  const keysInOrder = [...new Set(teamMatches.map(({ key }) => key))];
  const standings = keysInOrder.map((key) =>
    standingOf(teamMatches.filter((teamMatch) => teamMatch.key === key)),
  );
  return [...standings].sort(compareStandings);
}
