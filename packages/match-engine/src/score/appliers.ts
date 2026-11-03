import { err, ok, type Result } from "@sacou/volley-rules";

import type { EventApplier, EventRejection } from "../event-log/types.js";
import {
  FIRST_SET_NUMBER,
  LINEUP_CHANGED_EVENT_TYPE,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  MAX_FINISHED_MATCHES,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
} from "./constants.data.js";
import {
  parseLineupChangedPayload,
  parseMatchEndedPayload,
  parseMatchStartedPayload,
  parsePointScoredPayload,
  parseQueueChangedPayload,
  parseServingTeamChangedPayload,
  parseSetEndedPayload,
} from "./parse-payloads.js";
import { isQueueOverlappingTeams } from "./queue-rules.js";
import { isLiberoAllowed, isRosterPartition, isSideOut, nextSetterZone } from "./rotation-rules.js";
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
  queue: Object.freeze({ players: Object.freeze([]), teams: Object.freeze([]) }),
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
  return { currentMatch: match, finishedMatches: state.finishedMatches, queue: state.queue };
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

/**
 * Applies the recorded allocation. It checks the frozen `teams` and never the current lineup, so a
 * change that another writer interleaves with points is applied, and the last one in the order wins.
 * Whether the libero is on the court is never checked here: it is derived from the zone (ADR 0028).
 */
const applyLineupChanged: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseLineupChangedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { bench, libero, lineup, matchId, setterZone, team } = parsed.value;
  const match = findOpenMatch(state, matchId);
  const teamState = match?.rotations[team] ?? null;
  if (match === null || teamState === null) {
    return rejected();
  }
  const { system } = teamState;
  if (
    !isRosterPartition(lineup, bench, libero, match.teams[team]) ||
    !isLiberoAllowed(system, libero)
  ) {
    return rejected();
  }
  return ok(
    withCurrentMatch(state, {
      ...match,
      rotations: { ...match.rotations, [team]: { bench, libero, lineup, setterZone, system } },
    }),
  );
};

/**
 * Replaces the whole queue, checked against the frozen `teams` of the open match: nobody waiting is
 * on the court. Like the `LineupChanged`, the last one in the canonical order wins (ADR 0029).
 */
const applyQueueChanged: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseQueueChangedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { matchId, queue } = parsed.value;
  const match = findOpenMatch(state, matchId);
  if (match === null || isQueueOverlappingTeams(queue, match.teams)) {
    return rejected();
  }
  return ok({ currentMatch: match, finishedMatches: state.finishedMatches, queue });
};

/**
 * Records who serves and who served first in the open set, as the command decided: the score and
 * the current values are never checked, nobody rotates, and the last one in the order wins. It also
 * applies with the rotation off, because the serve is tracked anyway (ADR 0030).
 */
const applyServingTeamChanged: EventApplier<CourtSessionState> = (state, event) => {
  const parsed = parseServingTeamChangedPayload(event.payload);
  if (!parsed.ok) {
    return rejected();
  }
  const { firstServer, matchId, servingTeam, setNumber } = parsed.value;
  const match = findOpenMatch(state, matchId);
  const set = findOpenSet(match, setNumber);
  if (match === null || set === null) {
    return rejected();
  }
  return ok(
    withCurrentMatch(state, { ...match, currentSet: { ...set, firstServer, servingTeam } }),
  );
};

export const SCORE_APPLIERS: ReadonlyMap<string, EventApplier<CourtSessionState>> = new Map([
  [MATCH_STARTED_EVENT_TYPE, applyMatchStarted],
  [POINT_SCORED_EVENT_TYPE, applyPointScored],
  [SET_ENDED_EVENT_TYPE, applySetEnded],
  [MATCH_ENDED_EVENT_TYPE, applyMatchEnded],
  [LINEUP_CHANGED_EVENT_TYPE, applyLineupChanged],
  [QUEUE_CHANGED_EVENT_TYPE, applyQueueChanged],
  [SERVING_TEAM_CHANGED_EVENT_TYPE, applyServingTeamChanged],
]);
