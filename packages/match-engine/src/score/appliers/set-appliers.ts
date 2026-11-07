// Appliers of a set: PointScored, SetEnded and ServingTeamChanged.
import { ok } from "@sacou/volley-rules";

import type { EventApplier } from "../../event-log/types.js";
import {
  parsePointScoredPayload,
  parseServingTeamChangedPayload,
  parseSetEndedPayload,
} from "../parse-payloads.js";
import { isSideOut } from "../rotation-rules.js";
import type {
  CourtSessionState,
  MatchScore,
  NextSet,
  SetterZones,
  TeamRotations,
  TeamState,
} from "../types.js";
import {
  emptySet,
  findOpenMatch,
  findOpenSet,
  rejected,
  rotateTeam,
  withCurrentMatch,
} from "./applier-support.js";

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

export const applyPointScored: EventApplier<CourtSessionState> = (state, event) => {
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

export const applySetEnded: EventApplier<CourtSessionState> = (state, event) => {
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

/**
 * Records who serves and who served first in the open set, as the command decided: the score and
 * the current values are never checked, nobody rotates, and the last one in the order wins. It also
 * applies with the rotation off, because the serve is tracked anyway (ADR 0030).
 */
export const applyServingTeamChanged: EventApplier<CourtSessionState> = (state, event) => {
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
