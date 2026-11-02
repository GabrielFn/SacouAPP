import { err, ok, type Result } from "@sacou/volley-rules";

import type { EventApplier, EventRejection } from "../event-log/types.js";
import {
  FIRST_SET_NUMBER,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  MAX_FINISHED_MATCHES,
  POINT_SCORED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
} from "./constants.data.js";
import {
  parseMatchEndedPayload,
  parseMatchStartedPayload,
  parsePointScoredPayload,
  parseSetEndedPayload,
} from "./parse-payloads.js";
import { isSideOut, nextSetterZone } from "./rotation-rules.js";
import type {
  CourtSessionState,
  MatchScore,
  MatchSet,
  NextSet,
  SetterZones,
  TeamRotations,
  TeamSide,
  TeamState,
} from "./types.js";

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

function canOpenMatch(state: CourtSessionState, matchId: string): boolean {
  return (
    state.currentMatch === null &&
    state.finishedMatches.length < MAX_FINISHED_MATCHES &&
    !isFinishedMatchId(state, matchId)
  );
}

function emptySet(setNumber: number, targetPoints: number, firstServer: TeamSide): MatchSet {
  return {
    firstServer,
    score: { a: 0, b: 0 },
    servingTeam: firstServer,
    setNumber,
    targetPoints,
  };
}

function rotateTeam(rotations: TeamRotations, team: TeamSide): TeamRotations {
  const teamState = rotations[team];
  return teamState === null
    ? rotations
    : { ...rotations, [team]: { ...teamState, setterZone: nextSetterZone(teamState.setterZone) } };
}

/** Structure, not a rule: a recorded zone must match whether the team has a rotation at all. */
function hasZonesForTheRotations(rotations: TeamRotations, setterZones: SetterZones): boolean {
  return (
    (rotations.a === null) === (setterZones.a === null) &&
    (rotations.b === null) === (setterZones.b === null)
  );
}

function withRecordedZone(
  teamState: TeamState | null,
  setterZone: SetterZones["a"],
): TeamState | null {
  return teamState === null || setterZone === null ? null : { ...teamState, setterZone };
}

function withRecordedZones(rotations: TeamRotations, setterZones: SetterZones): TeamRotations {
  return {
    a: withRecordedZone(rotations.a, setterZones.a),
    b: withRecordedZone(rotations.b, setterZones.b),
  };
}

/** Structure, not a rule: the format has no set past `bestOf`, and no set number past the schema. */
function opensSetPastTheFormat(match: MatchScore, setNumber: number, nextSet: NextSet | null) {
  return nextSet !== null && setNumber >= match.scoring.bestOf;
}

const applyMatchStarted: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseMatchStartedPayload(event.payload);
  if (!parsed.ok || !canOpenMatch(state, parsed.value.matchId)) {
    return rejected();
  }
  const { firstServer, matchId, rotations, rulesVersion, scoring, teams } = parsed.value;
  return ok(
    withCurrentMatch(state, {
      completedSets: [],
      // Set 1 is never the deciding set of a series, so it always plays to `pointsPerSet`.
      currentSet: emptySet(FIRST_SET_NUMBER, scoring.pointsPerSet, firstServer),
      matchId,
      rotations,
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
  if (!isSideOut(set.servingTeam, team)) {
    return ok(withCurrentMatch(state, { ...match, currentSet: { ...set, score } }));
  }
  return ok(
    withCurrentMatch(state, {
      ...match,
      currentSet: { ...set, score, servingTeam: team },
      rotations: rotateTeam(match.rotations, team),
    }),
  );
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
  if (nextSet !== null && !hasZonesForTheRotations(match.rotations, nextSet.setterZones)) {
    return rejected();
  }
  return ok(
    withCurrentMatch(state, {
      ...match,
      completedSets: [...match.completedSets, { score: set.score, setNumber, winner }],
      currentSet:
        nextSet === null
          ? null
          : emptySet(setNumber + 1, nextSet.targetPoints, nextSet.firstServer),
      rotations:
        nextSet === null
          ? match.rotations
          : withRecordedZones(match.rotations, nextSet.setterZones),
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
  const { completedSets, currentSet, rotations, rulesVersion, scoring, setsWon, teams } = match;
  const finishedMatch = {
    completedSets,
    currentSet,
    endReason,
    matchId,
    rotations,
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
