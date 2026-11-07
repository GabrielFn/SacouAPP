// Commands of a team: lineup, substitution and rotation.
import { ok } from "@sacou/volley-rules";

import { LINEUP_CHANGED_EVENT_TYPE, ROTATION_DIRECTIONS, TEAM_SIDES } from "../constants.data.js";
import { parseLineupChangedPayload } from "../parse-payloads.js";
import {
  isLiberoAllowed,
  isRosterPartition,
  nextSetterZone,
  previousSetterZone,
} from "../rotation-rules.js";
import type {
  CourtSessionState,
  LineupAllocation,
  MatchScore,
  MemberId,
  RotationDirection,
  ScoreCommandResult,
  ScorePayloadField,
  TeamLibero,
  TeamRoster,
  TeamSide,
  TeamState,
} from "../types.js";
import { invalidField, refuse } from "./command-support.js";

function isSameOrder(first: readonly MemberId[], second: readonly MemberId[]): boolean {
  return first.length === second.length && first.every((id, index) => id === second[index]);
}

function isSameLibero(first: TeamLibero | null, second: TeamLibero | null): boolean {
  if (first === null || second === null) {
    return first === second;
  }
  return (
    first.memberId === second.memberId &&
    first.replacedIndexes.length === second.replacedIndexes.length &&
    first.replacedIndexes.every((index, position) => index === second.replacedIndexes[position])
  );
}

function isSameAllocation(teamState: TeamState, allocation: LineupAllocation): boolean {
  return (
    teamState.setterZone === allocation.setterZone &&
    isSameOrder(teamState.lineup, allocation.lineup) &&
    isSameOrder(teamState.bench, allocation.bench) &&
    isSameLibero(teamState.libero, allocation.libero)
  );
}

/** The field to blame when the allocation is not the team: lineup, then libero, then bench. */
function partitionField(
  { lineup, libero }: LineupAllocation,
  { memberIds }: TeamRoster,
): ScorePayloadField {
  if (!lineup.every((id) => memberIds.includes(id))) {
    return "lineup";
  }
  return libero === null || memberIds.includes(libero.memberId) ? "bench" : "libero";
}

function recordAllocation(
  { matchId, teams }: MatchScore,
  teamState: TeamState,
  team: TeamSide,
  input: LineupAllocation,
): ScoreCommandResult {
  const parsed = parseLineupChangedPayload({ ...input, matchId, team });
  if (!parsed.ok) {
    return parsed;
  }
  const { bench, libero, lineup } = parsed.value;
  const roster = teams[team];
  if (!isRosterPartition(lineup, bench, libero, roster)) {
    return invalidField(partitionField(parsed.value, roster));
  }
  if (!isLiberoAllowed(teamState.system, libero)) {
    return invalidField("libero");
  }
  return isSameAllocation(teamState, parsed.value)
    ? refuse("lineup-unchanged")
    : ok([{ type: LINEUP_CHANGED_EVENT_TYPE, payload: parsed.value }]);
}

/** Whoever has no rotation has no bench, so there is nothing to change (ADR 0027). */
function withOpenTeam(
  state: CourtSessionState,
  team: TeamSide,
  run: (match: MatchScore, teamState: TeamState) => ScoreCommandResult,
): ScoreCommandResult {
  const match = state.currentMatch;
  if (match === null) {
    return refuse("no-open-match");
  }
  if (!TEAM_SIDES.includes(team)) {
    return invalidField("team");
  }
  const teamState = match.rotations[team];
  return teamState === null ? refuse("rotation-off") : run(match, teamState);
}

/**
 * Saves the whole allocation of a team, as screen 22 has it: a swap between two members on the
 * court, the rotation selector, a new anchor of the setter, or another libero, or none. `system` does
 * not change in a match.
 */
export function changeLineup(
  state: CourtSessionState,
  team: TeamSide,
  allocation: LineupAllocation,
): ScoreCommandResult {
  return withOpenTeam(state, team, (match, teamState) =>
    recordAllocation(match, teamState, team, allocation),
  );
}

/**
 * The member who comes in takes the position of the one who goes out, and the zone stays. The rest
 * of the bench keeps its order, and the member who goes out goes to the end of it. The libero stays,
 * and covers whoever comes into a position it covers, because it covers positions, not members.
 */
export function substitutePlayer(
  state: CourtSessionState,
  team: TeamSide,
  outgoing: MemberId,
  incoming: MemberId,
): ScoreCommandResult {
  return withOpenTeam(state, team, (match, teamState) => {
    const { bench, libero, lineup, setterZone } = teamState;
    if (!lineup.includes(outgoing)) {
      return invalidField("lineup");
    }
    if (!bench.includes(incoming)) {
      return invalidField("bench");
    }
    return recordAllocation(match, teamState, team, {
      bench: [...bench.filter((id) => id !== incoming), outgoing],
      libero,
      lineup: lineup.map((id) => (id === outgoing ? incoming : id)),
      setterZone,
    });
  });
}

/**
 * Girar and desgirar on screen 24: the whole allocation is recorded with the zone next to the current
 * one, never a step the applier would calculate, and bench and libero stay (ADR 0030).
 */
export function shiftRotation(
  state: CourtSessionState,
  team: TeamSide,
  direction: RotationDirection,
): ScoreCommandResult {
  return withOpenTeam(state, team, (match, teamState) => {
    if (!ROTATION_DIRECTIONS.includes(direction)) {
      return refuse("invalid-rotation-direction");
    }
    const { bench, libero, lineup, setterZone } = teamState;
    const shifted =
      direction === "forward" ? nextSetterZone(setterZone) : previousSetterZone(setterZone);
    return recordAllocation(match, teamState, team, {
      bench,
      libero,
      lineup,
      setterZone: shifted,
    });
  });
}
