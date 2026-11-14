import type { TeamSide } from "@sacou/match-engine";

export interface CourtSides {
  /** The team drawn on the left (landscape) or at the top (upright). */
  readonly left: TeamSide;
  readonly right: TeamSide;
}

/** Team A at the left and B at the right, until "Inverter lados" swaps them. */
export function sidesOf(inverted: boolean): CourtSides {
  return inverted ? { left: "b", right: "a" } : { left: "a", right: "b" };
}
