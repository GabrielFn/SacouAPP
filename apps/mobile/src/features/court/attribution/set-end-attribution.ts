import {
  getUnattributedPoints,
  setsToWin,
  type CourtSessionTimeline,
  type MatchScore,
} from "@sacou/match-engine";

import { strings } from "../../../strings/pt-BR";
import { stateOfTimeline } from "../model/court-screen.selectors";

const CONFIRMED_SET = 1;

/** "3 pontos sem autor · Preencher" on screen 25, read before the set is confirmed (D10). */
export interface SetEndAttributionModel {
  readonly text: string;
  /** The points to ask about, oldest first. */
  readonly pointEventIds: readonly string[];
  /** "Última chance…": confirming this set closes the match, and nothing is filled in after (P2). */
  readonly lastChance: string | null;
}

/** The team ahead in the decided set wins it once it is confirmed. */
function closesMatch(match: MatchScore): boolean {
  const set = match.currentSet;
  if (set === null) {
    return false;
  }
  const winner = set.score.a > set.score.b ? "a" : "b";
  return match.setsWon[winner] + CONFIRMED_SET >= setsToWin(match.scoring.bestOf);
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
    lastChance: closesMatch(match) ? attribution.lastChance : null,
  };
}
