import type { CourtSessionTimeline } from "../corrections/types.js";
import { TEAM_SIDES } from "../score/constants.data.js";
import type { FinishedMatch, MemberId, TeamSide } from "../score/types.js";
import { groupByMatch } from "./by-match.js";
import { type PlayedRally, getPlayedRallies } from "./rally-balance.js";
import type { BySide, FinishedMatchResult, MatchResult, WinStreaks } from "./types.js";

const NO_STREAKS: WinStreaks = { longestWinStreak: 0, currentWinStreak: 0 };

/** A match without a winner is neither a win nor a loss for anyone (ADR 0032, P2). */
export function resultOfSide(
  { winner }: Pick<FinishedMatch, "winner">,
  side: TeamSide,
): MatchResult {
  if (winner === null) {
    return "undecided";
  }
  return winner === side ? "win" : "loss";
}

/**
 * Wins in a row: a loss and a match without a winner both break the run (ADR 0032, P1 and P2). The
 * current run is the one that ends with the last result.
 */
export function getWinStreaks(results: readonly MatchResult[]): WinStreaks {
  return results.reduce<WinStreaks>((streaks, result) => {
    const currentWinStreak = result === "win" ? streaks.currentWinStreak + 1 : 0;
    return {
      longestWinStreak: Math.max(streaks.longestWinStreak, currentWinStreak),
      currentWinStreak,
    };
  }, NO_STREAKS);
}

/**
 * Who played a finished match and how it went for each: everyone of a team, the bench and the
 * libero too, as `getMatchesPlayed` (ADR 0029). A member is in one team of a match only.
 */
export function getResultsOfMatch(match: FinishedMatch): ReadonlyMap<MemberId, MatchResult> {
  return new Map(
    TEAM_SIDES.flatMap((side) =>
      match.teams[side].memberIds.map((memberId) => [memberId, resultOfSide(match, side)] as const),
    ),
  );
}

/**
 * Everyone who played a finished match, in the order they first appear: `teams.a`, then `teams.b`,
 * match by match. Never ordered by `MemberId` (ADR 0032).
 */
export function getMembersInOrder(finishedMatches: readonly FinishedMatch[]): readonly MemberId[] {
  return [
    ...new Set(
      finishedMatches.flatMap(({ teams }) => [...teams.a.memberIds, ...teams.b.memberIds]),
    ),
  ];
}

/** The members of `team` who stood on the court in one of the rallies, in the order of the team. */
function onCourtOf(
  team: readonly MemberId[],
  rallies: readonly PlayedRally[],
  side: TeamSide,
): readonly MemberId[] {
  const rallied = new Set(rallies.flatMap(({ onCourt }) => onCourt[side]));
  return team.filter((memberId) => rallied.has(memberId));
}

function pointsOf(rallies: readonly PlayedRally[], side: TeamSide): number {
  return rallies.filter(({ team }) => team === side).length;
}

function bySide<T>(valueOf: (side: TeamSide) => T): BySide<T> {
  return { a: valueOf("a"), b: valueOf("b") };
}

/**
 * Each finished match of the court session, in the order of the `MatchEnded`: the winner, the teams
 * as started, who of them played at least one active rally (rules 2 and 3 of the statistics; with
 * the rotation off, the whole team) and the rallies each side won. The open match is not here.
 */
export function getMatchResults(timeline: CourtSessionTimeline): readonly FinishedMatchResult[] {
  const finishedMatches = timeline.entries.at(-1)?.state.finishedMatches ?? [];
  const ralliesByMatch = groupByMatch(getPlayedRallies(timeline));
  return finishedMatches.map(({ matchId, winner, teams }) => {
    const rallies = ralliesByMatch.get(matchId) ?? [];
    return {
      matchId,
      winner,
      teams: bySide((side) => teams[side].memberIds),
      onCourt: bySide((side) => onCourtOf(teams[side].memberIds, rallies, side)),
      points: bySide((side) => pointsOf(rallies, side)),
    };
  });
}
