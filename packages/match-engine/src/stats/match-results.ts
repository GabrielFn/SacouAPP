import { TEAM_SIDES } from "../score/constants.data.js";
import type { FinishedMatch, MemberId, TeamSide } from "../score/types.js";
import type { MatchResult, WinStreaks } from "./types.js";

const NO_STREAKS: WinStreaks = { longestWinStreak: 0, currentWinStreak: 0 };

/** A match without a winner is neither a win nor a loss for anyone (ADR 0032, P2). */
export function resultOfSide({ winner }: FinishedMatch, side: TeamSide): MatchResult {
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
