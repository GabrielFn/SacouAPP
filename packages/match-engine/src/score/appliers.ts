import { err, ok, type Result } from "@sacou/volley-rules";

import type { EventApplier, EventRejection } from "../event-log/types.js";
import {
  FIRST_SET_NUMBER,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  POINT_SCORED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
} from "./constants.data.js";
import {
  parseMatchEndedPayload,
  parseMatchStartedPayload,
  parsePointScoredPayload,
  parseSetEndedPayload,
} from "./parse-payloads.js";
import { targetPointsForSet } from "./scoring-rules.js";
import type { CourtSessionState, MatchScore, MatchSet, NextSet } from "./types.js";

export const INITIAL_COURT_SESSION_STATE: CourtSessionState = Object.freeze({
  currentMatch: null,
  finishedMatches: Object.freeze([]),
});

function rejected(): Result<never, EventRejection> {
  return err({ code: "event-rejected" });
}

function findOpenMatch(state: CourtSessionState, matchId: string): MatchScore | null {
  const { currentMatch } = state;
  return currentMatch?.matchId === matchId ? currentMatch : null;
}

function findOpenSet(match: MatchScore | null, setNumber: number): MatchSet | null {
  const currentSet = match?.currentSet ?? null;
  return currentSet?.setNumber === setNumber ? currentSet : null;
}

function withCurrentMatch(state: CourtSessionState, match: MatchScore): CourtSessionState {
  return { currentMatch: match, finishedMatches: state.finishedMatches };
}

function isFinishedMatchId(state: CourtSessionState, matchId: string): boolean {
  return state.finishedMatches.some((match) => match.matchId === matchId);
}

function emptySet(setNumber: number, targetPoints: number): MatchSet {
  return { score: { a: 0, b: 0 }, setNumber, targetPoints };
}

/** Structure, not a rule: the format has no set past `bestOf`, and no set number past the schema. */
function opensSetPastTheFormat(match: MatchScore, setNumber: number, nextSet: NextSet | null) {
  return nextSet !== null && setNumber >= match.scoring.bestOf;
}

const applyMatchStarted: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseMatchStartedPayload(event.payload);
  if (!parsed.ok || state.currentMatch !== null || isFinishedMatchId(state, parsed.value.matchId)) {
    return rejected();
  }
  const { matchId, rulesVersion, scoring, teams } = parsed.value;
  return ok(
    withCurrentMatch(state, {
      completedSets: [],
      currentSet: emptySet(FIRST_SET_NUMBER, targetPointsForSet(scoring, FIRST_SET_NUMBER)),
      matchId,
      rulesVersion,
      scoring,
      setsWon: { a: 0, b: 0 },
      teams,
    }),
  );
};

const applyPointScored: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parsePointScoredPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { matchId, setNumber, team } = parsed.value;
  const match = findOpenMatch(state, matchId);
  const set = findOpenSet(match, setNumber);
  if (match === null || set === null) {
    return rejected();
  }
  const score = { ...set.score, [team]: set.score[team] + 1 };
  return ok(withCurrentMatch(state, { ...match, currentSet: { ...set, score } }));
};

const applySetEnded: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseSetEndedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { matchId, nextSet, setNumber, winner } = parsed.value;
  const match = findOpenMatch(state, matchId);
  const set = findOpenSet(match, setNumber);
  if (match === null || set === null || opensSetPastTheFormat(match, setNumber, nextSet)) {
    return rejected();
  }
  return ok(
    withCurrentMatch(state, {
      ...match,
      completedSets: [...match.completedSets, { score: set.score, setNumber, winner }],
      currentSet: nextSet === null ? null : emptySet(setNumber + 1, nextSet.targetPoints),
      setsWon: { ...match.setsWon, [winner]: match.setsWon[winner] + 1 },
    }),
  );
};

const applyMatchEnded: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseMatchEndedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { endReason, matchId, winner } = parsed.value;
  const match = findOpenMatch(state, matchId);
  if (match === null || (endReason === "sets-won" && match.currentSet !== null)) {
    return rejected();
  }
  const { completedSets, currentSet, rulesVersion, scoring, setsWon, teams } = match;
  const finishedMatch = {
    completedSets,
    currentSet,
    endReason,
    matchId,
    rulesVersion,
    scoring,
    setsWon,
    teams,
    winner,
  };
  return ok({ currentMatch: null, finishedMatches: [...state.finishedMatches, finishedMatch] });
};

export const SCORE_APPLIERS: ReadonlyMap<string, EventApplier<CourtSessionState>> = new Map([
  [MATCH_STARTED_EVENT_TYPE, applyMatchStarted],
  [POINT_SCORED_EVENT_TYPE, applyPointScored],
  [SET_ENDED_EVENT_TYPE, applySetEnded],
  [MATCH_ENDED_EVENT_TYPE, applyMatchEnded],
]);
