import type { MvpCandidate } from "../../../../services/api/sacou-api";

function byMatchesThenBalance(first: MvpCandidate, second: MvpCandidate): number {
  return second.matchesPlayed - first.matchesPlayed || second.plusMinus - first.plusMinus;
}

/**
 * The order of the ballot (question 177): more matches first, then more balance, then the order of the
 * server (the sort is stable). It has nothing to do with votes, which the app never sees.
 */
export function orderBallot(candidates: readonly MvpCandidate[]): readonly MvpCandidate[] {
  return [...candidates].sort(byMatchesThenBalance);
}
