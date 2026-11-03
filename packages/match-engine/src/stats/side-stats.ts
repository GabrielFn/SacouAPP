import type { CourtSessionTimeline } from "../corrections/types.js";
import type { FinishedMatch, TeamSide } from "../score/types.js";
import { getWinStreaks, resultOfSide } from "./match-results.js";
import type { SideStats, SidesStats } from "./types.js";

function sideStatsOf(finishedMatches: readonly FinishedMatch[], side: TeamSide): SideStats {
  const results = finishedMatches.map((match) => resultOfSide(match, side));
  const { longestWinStreak, currentWinStreak } = getWinStreaks(results);
  return {
    wins: results.filter((result) => result === "win").length,
    longestWinStreak,
    currentWinStreak,
  };
}

/**
 * "Time que mais venceu" and "Maior sequência" of screen 16, and the "3ª seguida" of screen 11: a
 * team is a side of the court, whoever plays on it after a partial exit (ADR 0032, P3). Only the
 * finished matches count.
 */
export function getSideStats({ entries }: CourtSessionTimeline): SidesStats {
  const finishedMatches = entries.at(-1)?.state.finishedMatches ?? [];
  return { a: sideStatsOf(finishedMatches, "a"), b: sideStatsOf(finishedMatches, "b") };
}
