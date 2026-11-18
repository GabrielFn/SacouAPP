import { getOpponent, type RecentPoint } from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import type { CourtRoster } from "../ports/court-roster";

/** Who scored a line of screen 24, by the last answer (ADR 0031, P3: an answer is only changed). */
export function authorTextOf(point: RecentPoint, matchId: string, roster: CourtRoster): string {
  const { attribution } = strings.courtPlayers;
  if (point.kind === null) {
    return attribution.noAuthor;
  }
  if (point.kind === "opponent-error" || point.author === null) {
    return attribution.opponentError(roster.teamAppearance(matchId, getOpponent(point.team)).label);
  }
  return attribution.rowAuthor(attribution.kinds[point.kind], roster.nameOf(point.author));
}

export function sideOutTextOf(point: RecentPoint): string | null {
  if (!point.sideOut) {
    return null;
  }
  const { corrections } = strings.court;
  return point.setterZone === null
    ? corrections.sideOut
    : corrections.sideOutRotation(point.setterZone);
}
