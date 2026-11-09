import type { MemberId, TeamSide } from "@sacou/match-engine";

import type { TeamColorName } from "../../../theme/team-colors";

export interface TeamAppearance {
  readonly label: string;
  readonly color: TeamColorName;
}

/**
 * Names and team colors are not in the events (eventos.md): the screen asks for them here. In E4.9
 * the only implementation is the sample; the pre-game (E4.7) provides the real one, which must work
 * offline (E4.2). Nothing from here is ever written to the court log.
 */
export interface CourtRoster {
  /** A member without a known name gets a neutral one, so the court never shows an empty chip. */
  nameOf(memberId: MemberId): string;
  teamAppearance(matchId: string, side: TeamSide): TeamAppearance;
}
