// Appliers of the match: MatchStarted and MatchEnded.
import { ok } from "@sacou/volley-rules";

import type { EventApplier } from "../../event-log/types.js";
import { FIRST_SET_NUMBER, MAX_FINISHED_MATCHES } from "../constants.data.js";
import { parseMatchEndedPayload, parseMatchStartedPayload } from "../parse-payloads.js";
import type { CourtSessionState } from "../types.js";
import { emptySet, findOpenMatch, isFinishedMatchId, rejected } from "./applier-support.js";

function canOpenMatch(state: CourtSessionState, matchId: string): boolean {
  return (
    state.currentMatch === null &&
    state.finishedMatches.length < MAX_FINISHED_MATCHES &&
    !isFinishedMatchId(state, matchId)
  );
}

export const applyMatchStarted: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseMatchStartedPayload(event.payload);
  if (!parsed.ok || !canOpenMatch(state, parsed.value.matchId)) {
    return rejected();
  }
  const {
    firstServer,
    formationsVersion,
    matchId,
    queue,
    rotations,
    rulesVersion,
    scoring,
    teams,
  } = parsed.value;
  return ok({
    currentMatch: {
      completedSets: [],
      // Set 1 is never the deciding set of a series, so it always plays to `pointsPerSet`.
      currentSet: emptySet(FIRST_SET_NUMBER, scoring.pointsPerSet, firstServer),
      formationsVersion,
      matchId,
      rotations,
      rulesVersion,
      scoring,
      setsWon: { a: 0, b: 0 },
      teams,
    },
    finishedMatches: state.finishedMatches,
    queue,
  });
};

export const applyMatchEnded: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseMatchEndedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { endReason, matchId, winner } = parsed.value;
  const match = findOpenMatch(state, matchId);
  if (match === null || (endReason === "sets-won" && match.currentSet !== null)) {
    return rejected();
  }
  const {
    completedSets,
    currentSet,
    formationsVersion,
    rotations,
    rulesVersion,
    scoring,
    setsWon,
    teams,
  } = match;
  const finishedMatch = {
    completedSets,
    currentSet,
    endReason,
    formationsVersion,
    matchId,
    rotations,
    rulesVersion,
    scoring,
    setsWon,
    teams,
    winner,
  };
  return ok({
    currentMatch: null,
    finishedMatches: [...state.finishedMatches, finishedMatch],
    queue: state.queue,
  });
};
