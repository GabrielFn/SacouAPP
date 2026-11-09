import {
  TEAM_SIDES,
  type CourtSessionState,
  type FinishedMatch,
  type MemberId,
  type TeamSide,
} from "@sacou/match-engine";

export interface WinStreak {
  readonly side: TeamSide;
  readonly count: number;
}

const HALF = 2;

/** True when most of the current team came from the team that won (the team may have changed a player). */
function wonByMostOf(match: FinishedMatch, currentMembers: readonly MemberId[]): boolean {
  if (match.winner === null) {
    return false;
  }
  const winners = new Set(match.teams[match.winner].memberIds);
  const shared = currentMembers.filter((member) => winners.has(member)).length;
  return shared * HALF > currentMembers.length;
}

function streakOf(finished: readonly FinishedMatch[], members: readonly MemberId[]): number {
  const recentFirst = [...finished].reverse();
  const broken = recentFirst.findIndex((match) => !wonByMostOf(match, members));
  return broken < 0 ? recentFirst.length : broken;
}

/**
 * How many finished matches in a row (the most recent first) were won by a team made mostly of the
 * current team, for the side that has the longest run; `null` with none. A pure function of the
 * state, so another rule for "stays on the court" only changes this file.
 */
export function selectWinStreak({
  currentMatch,
  finishedMatches,
}: CourtSessionState): WinStreak | null {
  if (currentMatch === null) {
    return null;
  }
  const runs = TEAM_SIDES.map((side) => ({
    side,
    count: streakOf(finishedMatches, currentMatch.teams[side].memberIds),
  }));
  const best = runs.reduce((top, run) => (run.count > top.count ? run : top));
  return best.count > 0 ? best : null;
}
