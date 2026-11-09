// Commands of the match: start it and end it by hand.
import { FORMATION_CATALOG_VERSION, ok } from "@sacou/volley-rules";

import {
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  MAX_FINISHED_MATCHES,
  SUPPORTED_RULES_VERSIONS,
} from "../constants.data.js";
import { parseMatchStartedPayload } from "../parse-payloads.js";
import type {
  CourtSessionState,
  MatchStartedPayload,
  ScoreCommandResult,
  TeamSide,
} from "../types.js";
import { emit, invalidField, refuse } from "./command-support.js";

export function startMatch(
  state: CourtSessionState,
  input: MatchStartedPayload,
): ScoreCommandResult {
  const parsed = parseMatchStartedPayload(input);
  if (!parsed.ok) {
    return parsed;
  }
  const { formationsVersion, matchId, rulesVersion } = parsed.value;
  if (!SUPPORTED_RULES_VERSIONS.includes(rulesVersion)) {
    return refuse("unsupported-rules-version");
  }
  if (formationsVersion !== FORMATION_CATALOG_VERSION) {
    return refuse("unsupported-formations-version");
  }
  if (state.currentMatch !== null) {
    return refuse("match-already-open");
  }
  if (state.finishedMatches.length >= MAX_FINISHED_MATCHES) {
    return refuse("too-many-matches");
  }
  if (state.finishedMatches.some((match) => match.matchId === matchId)) {
    return invalidField("matchId");
  }
  return ok([{ type: MATCH_STARTED_EVENT_TYPE, payload: parsed.value }]);
}

/** Records the winner the caller decided: who wins an unfinished match is not a rule here. */
export function endMatchManually(
  state: CourtSessionState,
  winner: TeamSide | null,
): ScoreCommandResult {
  const match = state.currentMatch;
  return match === null
    ? refuse("no-open-match")
    : emit(MATCH_ENDED_EVENT_TYPE, { endReason: "manual", matchId: match.matchId, winner });
}
