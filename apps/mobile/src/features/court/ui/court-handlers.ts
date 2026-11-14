import type { TeamSide } from "@sacou/match-engine";

/** What the court asks of the route that holds it, the same for the upright and the landscape layout. */
export interface CourtHandlers {
  readonly onPoint: (team: TeamSide) => void;
  readonly onUndo: () => void;
  readonly onCorrect: () => void;
  readonly onOpenMenu: () => void;
}
