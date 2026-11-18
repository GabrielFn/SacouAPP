import type { CourtSessionState, MatchScore, MatchSet, TeamSide } from "@sacou/match-engine";

export interface CourtSides {
  /** The team drawn on the left (landscape) or at the top (upright). */
  readonly left: TeamSide;
  readonly right: TeamSide;
}

const HALVES = 2;
const SINGLE_SET = 1;

/** Team A at the left and B at the right, until the sides are swapped. */
export function sidesOf(inverted: boolean): CourtSides {
  return inverted ? { left: "b", right: "a" } : { left: "a", right: "b" };
}

function isEvenSet({ setNumber }: MatchSet): boolean {
  return setNumber % HALVES === 0;
}

/**
 * The tie-break swaps the sides once, when a team reaches half of its target, rounded up: 8 with 15
 * and 6 with 11 (`rotacoes.md`). A set that is not a tie-break never swaps in the middle.
 */
function isTieBreakSecondHalf({ scoring }: MatchScore, set: MatchSet): boolean {
  const { bestOf, tieBreakPoints } = scoring;
  if (tieBreakPoints === null || bestOf === SINGLE_SET || set.setNumber !== bestOf) {
    return false;
  }
  return Math.max(set.score.a, set.score.b) >= Math.ceil(tieBreakPoints / HALVES);
}

/**
 * Whether the court draws B at the left: the teams change sides every set and in the middle of the
 * tie-break, as in volleyball, and "Inverter lados" flips that for those who do not move (E4.10, D5).
 * It is a function of the score, so undoing the 8th point of the tie-break swaps them back.
 */
export function courtSidesInverted(state: CourtSessionState, manualInverted: boolean): boolean {
  const match = state.currentMatch;
  const set = match?.currentSet ?? null;
  if (match === null || set === null) {
    return manualInverted;
  }
  return manualInverted !== (isEvenSet(set) !== isTieBreakSecondHalf(match, set));
}
