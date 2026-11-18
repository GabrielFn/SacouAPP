import type { MatchScore, TeamSide } from "@sacou/match-engine";

/** The team ahead in a pair of counts, or `null` when they are level. */
function leaderOf(counts: Readonly<Record<TeamSide, number>>): TeamSide | null {
  if (counts.a === counts.b) {
    return null;
  }
  return counts.a > counts.b ? "a" : "b";
}

/**
 * Who wins a match ended by hand (Gabriel, answer 7): the team ahead in sets and, with the sets
 * level, the team ahead in the set in progress. Level in both, or no open set, is no winner and
 * nobody leaves the court. "Points" is the score of the set in play, the one the court shows.
 */
export function manualEndWinner(match: MatchScore): TeamSide | null {
  return leaderOf(match.setsWon) ?? (match.currentSet === null ? null : leaderOf(match.currentSet.score));
}
