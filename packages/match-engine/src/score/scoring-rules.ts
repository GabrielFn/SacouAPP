import { MAJORITY_DIVISOR, TEAM_SIDES } from "./constants.data.js";
import type { BestOf, ScoringRules, SetScore, SetsWon, TeamSide, WinMargin } from "./types.js";

/** The tie-break is only the deciding set of a series: a single set uses `pointsPerSet`. */
export function targetPointsForSet(rules: ScoringRules, setNumber: number): number {
  const { bestOf, pointsPerSet, tieBreakPoints } = rules;
  const isDecidingSet = bestOf > 1 && setNumber === bestOf;
  return isDecidingSet && tieBreakPoints !== null ? tieBreakPoints : pointsPerSet;
}

export function setsToWin(bestOf: BestOf): number {
  return Math.ceil(bestOf / MAJORITY_DIVISOR);
}

/** Only detects: a set ends when its end is confirmed, never by the rule alone. */
export function getSetWinner(
  score: SetScore,
  targetPoints: number,
  winMargin: WinMargin,
): TeamSide | null {
  const leader: TeamSide = score.a >= score.b ? "a" : "b";
  const trailer: TeamSide = leader === "a" ? "b" : "a";
  const hasWon = score[leader] >= targetPoints && score[leader] - score[trailer] >= winMargin;
  return hasWon ? leader : null;
}

/** A list, because without advantage both teams can have set point. Empty once decided. */
export function getSetPointTeams(
  score: SetScore,
  targetPoints: number,
  winMargin: WinMargin,
): readonly TeamSide[] {
  if (getSetWinner(score, targetPoints, winMargin) !== null) {
    return [];
  }
  return TEAM_SIDES.filter((team) => {
    const nextScore = { ...score, [team]: score[team] + 1 };
    return getSetWinner(nextScore, targetPoints, winMargin) === team;
  });
}

export function getMatchWinner(setsWon: SetsWon, bestOf: BestOf): TeamSide | null {
  const needed = setsToWin(bestOf);
  return TEAM_SIDES.find((team) => setsWon[team] >= needed) ?? null;
}
