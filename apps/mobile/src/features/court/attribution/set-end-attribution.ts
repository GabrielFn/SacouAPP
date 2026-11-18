import { getUnattributedPoints, type CourtSessionTimeline } from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import { decidedSetClosesMatch } from "../model/set-closure";
import { stateOfTimeline } from "../model/court-screen.selectors";

/** "3 pontos sem autor · Preencher" on screen 25, read before the set is confirmed (D10). */
export interface SetEndAttributionModel {
  readonly text: string;
  /** The points to ask about, oldest first. */
  readonly pointEventIds: readonly string[];
  /** "Última chance…": confirming this set closes the match, and nothing is filled in after (P2). */
  readonly lastChance: string | null;
}

/** `null` with every point of the set answered, or with "Ponto individual" off. */
export function setEndAttribution(
  timeline: CourtSessionTimeline,
  individualPoints: boolean,
): SetEndAttributionModel | null {
  const match = stateOfTimeline(timeline).currentMatch;
  const pointEventIds = getUnattributedPoints(timeline).map(({ eventId }) => eventId);
  if (!individualPoints || match === null || pointEventIds.length === 0) {
    return null;
  }
  const { attribution } = strings.courtPlayers;
  return {
    text: attribution.unattributed(pointEventIds.length),
    pointEventIds,
    lastChance: decidedSetClosesMatch(match) ? attribution.lastChance : null,
  };
}
