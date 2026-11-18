import { getSetWinner, setsToWin, type MatchScore, type TeamSide } from "@sacou/match-engine";

const CONFIRMED_SET = 1;

/** The set is won on the court but not confirmed yet: the engine still holds it as the current set. */
export function decidedSetWinner(match: MatchScore): TeamSide | null {
  const set = match.currentSet;
  return set === null ? null : getSetWinner(set.score, set.targetPoints, match.scoring.winMargin);
}

/** Confirming the set `winner` took ends the match: the one place that says so. */
export function confirmingClosesMatch(match: MatchScore, winner: TeamSide): boolean {
  return match.setsWon[winner] + CONFIRMED_SET >= setsToWin(match.scoring.bestOf);
}

/** The decided set, once confirmed, closes the match. `false` while no set is decided. */
export function decidedSetClosesMatch(match: MatchScore): boolean {
  const winner = decidedSetWinner(match);
  return winner !== null && confirmingClosesMatch(match, winner);
}
