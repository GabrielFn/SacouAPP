import {
  ROTATION_SLOTS,
  type FormationPhase,
  type FormationSystem,
  type RotationSlot,
  type SetterZone,
} from "@sacou/volley-rules";

import {
  BACK_ROW_SLOTS,
  DIAGONAL_INDEX_DISTANCE,
  LIBERO_SYSTEMS,
  MAX_LIBERO_REPLACED_INDEXES,
  MIN_LIBERO_REPLACED_INDEXES,
  SERVING_SLOT,
  SETTER_LINEUP_INDEXES,
  SETTER_ZONE_SEQUENCE,
  TEAM_SIDES,
} from "./constants.data.js";
import type { MatchScore, MemberId, TeamLibero, TeamRoster, TeamSide, TeamState } from "./types.js";

const [FIRST_ZONE_OF_THE_SEQUENCE] = SETTER_ZONE_SEQUENCE;

/** Past the end of the sequence there is no next zone, and the rotation starts over. */
export function nextSetterZone(zone: SetterZone): SetterZone {
  const index = SETTER_ZONE_SEQUENCE.indexOf(zone);
  return SETTER_ZONE_SEQUENCE[index + 1] ?? FIRST_ZONE_OF_THE_SEQUENCE;
}

/** Only the team that was receiving and won the rally rotates and takes the serve. */
export function isSideOut(servingTeam: TeamSide, pointWinner: TeamSide): boolean {
  return servingTeam !== pointWinner;
}

/** Alternates from who served first in the set: it is not "who lost serves". */
export function getNextSetFirstServer(firstServer: TeamSide): TeamSide {
  return firstServer === TEAM_SIDES[0] ? TEAM_SIDES[1] : TEAM_SIDES[0];
}

/**
 * The lineup from slot 1 to slot 6. The position in the sequence is how many times the team rotated
 * from the setter in slot 1, and each rotation brings the next member of the lineup to slot 1.
 */
export function getLineupBySlot<T = MemberId>(
  lineup: readonly T[],
  setterZone: SetterZone,
): readonly T[] {
  const rotationCount = SETTER_ZONE_SEQUENCE.indexOf(setterZone);
  return [...lineup.slice(rotationCount), ...lineup.slice(0, rotationCount)];
}

/** Who is in slot 1. The lineup has six members by the parser, so the entry always exists. */
export function getServingPlayer(lineup: readonly MemberId[], setterZone: SetterZone): MemberId {
  return lineup[SETTER_ZONE_SEQUENCE.indexOf(setterZone)] as MemberId;
}

/** Lineup, bench and libero together hold each member of the team exactly once, and nobody else. */
export function isRosterPartition(
  lineup: readonly MemberId[],
  bench: readonly MemberId[],
  libero: TeamLibero | null,
  { memberIds }: TeamRoster,
): boolean {
  const allocated =
    libero === null ? [...lineup, ...bench] : [...lineup, ...bench, libero.memberId];
  return (
    allocated.length === memberIds.length &&
    new Set(allocated).size === allocated.length &&
    allocated.every((id) => memberIds.includes(id))
  );
}

/** `null` with no open set, or when the team that serves has its rotation off. */
export function getCurrentServingPlayer({ currentSet, rotations }: MatchScore): MemberId | null {
  const teamState = currentSet === null ? null : rotations[currentSet.servingTeam];
  return teamState === null ? null : getServingPlayer(teamState.lineup, teamState.setterZone);
}

/** The indexes of `lineup` from slot 1 to slot 6, by the same table that places the members. */
const LINEUP_INDEXES: readonly number[] = ROTATION_SLOTS.map((_slot, index) => index);

/**
 * The shape of the positions a libero covers, which needs no system: one index or a diagonal, in
 * ascending order, each one an index of the lineup.
 */
export function isLiberoCoverage(replacedIndexes: readonly number[]): boolean {
  const [first, second] = replacedIndexes;
  const isIndex = (index: number) => LINEUP_INDEXES.includes(index);
  if (
    replacedIndexes.length < MIN_LIBERO_REPLACED_INDEXES ||
    replacedIndexes.length > MAX_LIBERO_REPLACED_INDEXES ||
    !replacedIndexes.every(isIndex)
  ) {
    return false;
  }
  return second === undefined || second - (first as number) === DIAGONAL_INDEX_DISTANCE;
}

/** Only the 5x1 and the 6x2 have a libero, and the libero never covers a setter (ADR 0028). */
export function isLiberoAllowed(system: FormationSystem, libero: TeamLibero | null): boolean {
  if (libero === null) {
    return true;
  }
  const setterIndexes = SETTER_LINEUP_INDEXES[system];
  return (
    LIBERO_SYSTEMS.includes(system) &&
    !libero.replacedIndexes.some((index) => setterIndexes.includes(index))
  );
}

/**
 * The slot the libero stands in, or `null` when the libero is out: off, the covered positions in the
 * front row, or the covered member in slot 1 of a team that serves, because the libero never serves.
 * A diagonal has one position in the back row and one in the front row, so there is one slot at most.
 */
export function getLiberoSlot(
  { libero, lineup, setterZone }: Pick<TeamState, "libero" | "lineup" | "setterZone">,
  phase: FormationPhase,
): RotationSlot | null {
  if (libero === null) {
    return null;
  }
  const indexBySlot = getLineupBySlot(LINEUP_INDEXES, setterZone);
  const slot = BACK_ROW_SLOTS.find((backSlot) =>
    libero.replacedIndexes.includes(indexBySlot[ROTATION_SLOTS.indexOf(backSlot)] as number),
  );
  if (slot === undefined || (phase === "serving" && slot === SERVING_SLOT)) {
    return null;
  }
  return slot;
}

/**
 * Who is on the court, from slot 1 to slot 6: the lineup, with the libero in the slot of the member
 * it covers. `getLineupBySlot` stays the order of the rotation, and who serves is read from it.
 */
export function getOnCourtBySlot(
  teamState: Pick<TeamState, "libero" | "lineup" | "setterZone">,
  phase: FormationPhase,
): readonly MemberId[] {
  const lineupBySlot = getLineupBySlot(teamState.lineup, teamState.setterZone);
  const liberoSlot = getLiberoSlot(teamState, phase);
  const { libero } = teamState;
  if (liberoSlot === null || libero === null) {
    return lineupBySlot;
  }
  const liberoIndex = ROTATION_SLOTS.indexOf(liberoSlot);
  return lineupBySlot.map((memberId, index) =>
    index === liberoIndex ? libero.memberId : memberId,
  );
}
