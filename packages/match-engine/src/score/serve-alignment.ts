import {
  FORMATION_CATALOG_VERSION,
  getFormation,
  ROTATION_SLOTS,
  validateOverlap,
  type CourtPoint,
  type Formation,
  type FormationOverlapOptions,
  type FormationPhase,
  type OverlapCheck,
  type OverlapError,
  type PlayerRole,
  type Result,
  type RotationSlot,
} from "@sacou/volley-rules";

import {
  ACTING_SETTER_ROLES,
  LIBERO_ROLE,
  SWAPPED_PAIR_ROLES,
  ZONE_FORMATIONS,
} from "./constants.data.js";
import { getLiberoSlot, getLineupBySlot } from "./rotation-rules.js";
import type {
  MatchScore,
  MemberId,
  ServeAlignment,
  ServeAlignmentSlot,
  TeamSide,
  TeamState,
} from "./types.js";

function fromSlots<T>(readSlot: (slot: RotationSlot, index: number) => T) {
  return Object.fromEntries(
    ROTATION_SLOTS.map((slot, index) => [slot, readSlot(slot, index)]),
  ) as Record<RotationSlot, T>;
}

/**
 * Where the libero is out, the slot of the libero in the catalog belongs to the member the libero
 * would replace. Who is out is derived from the zone, never from `liberoReplaces` (ADR 0028).
 */
function roleWithLiberoOff({ liberoReplaces, slots }: Formation, slot: RotationSlot): PlayerRole {
  const { role } = slots[slot];
  // The catalog has a libero only in formations that say whom the libero replaces.
  return role === LIBERO_ROLE ? (liberoReplaces as PlayerRole) : role;
}

/** A lineup has six members by the parser, and each slot of a formation has one of them. */
function findActingSetter(
  { slots }: Formation,
  actingSetterRole: PlayerRole,
  lineupBySlot: readonly MemberId[],
): MemberId {
  const index = ROTATION_SLOTS.findIndex((slot) => slots[slot].role === actingSetterRole);
  return lineupBySlot[index] as MemberId;
}

function roleInTheZone(formation: Formation, slot: RotationSlot, swapPairs: boolean): PlayerRole {
  const role = roleWithLiberoOff(formation, slot);
  return swapPairs ? (SWAPPED_PAIR_ROLES[role] ?? role) : role;
}

/**
 * The formation is chosen by the zone of the lineup, and the members stand where the lineup puts
 * them; the libero takes the point of the member it covers. Reads the current catalog: it is for a
 * team state of this version of the app, and `getTeamServeAlignment` is what checks the version of
 * a recorded match.
 */
export function getServeAlignment(
  teamState: Pick<TeamState, "libero" | "lineup" | "setterZone" | "system">,
  phase: FormationPhase,
): ServeAlignment {
  const { libero, lineup, setterZone, system } = teamState;
  const { formationKey, swapPairs } = ZONE_FORMATIONS[system][setterZone];
  // The table only has keys of the catalog, and a test holds it to `rotationOrder`.
  const formation = getFormation(system, formationKey, phase) as Formation;
  const lineupBySlot = getLineupBySlot(lineup, setterZone);
  const liberoSlot = getLiberoSlot(teamState, phase);
  const slots = fromSlots<ServeAlignmentSlot>((slot, index) => {
    const { point } = formation.slots[slot];
    return libero !== null && slot === liberoSlot
      ? { memberId: libero.memberId, role: LIBERO_ROLE, point }
      : {
          memberId: lineupBySlot[index] as MemberId,
          role: roleInTheZone(formation, slot, swapPairs),
          point,
        };
  });
  return {
    system,
    setterZone,
    formationKey,
    phase,
    actingSetter: findActingSetter(formation, ACTING_SETTER_ROLES[system], lineupBySlot),
    slots,
  };
}

/**
 * The alignment a team has right now. `null` when there is nothing to show: no match, no open set,
 * the rotation of that team off, or a match recorded with a formation catalog this app does not
 * have.
 */
export function getTeamServeAlignment(
  match: MatchScore | null,
  team: TeamSide,
): ServeAlignment | null {
  const currentSet = match?.currentSet ?? null;
  if (match === null || currentSet === null) {
    return null;
  }
  const teamState = match.rotations[team];
  if (teamState === null || match.formationsVersion !== FORMATION_CATALOG_VERSION) {
    return null;
  }
  return getServeAlignment(teamState, currentSet.servingTeam === team ? "serving" : "receiving");
}

/** Tells the caller, who shows the warning: an overlap never blocks the match (ADR 0010). */
export function validateServeAlignment(
  { phase, slots }: ServeAlignment,
  options: FormationOverlapOptions,
): Result<OverlapCheck, OverlapError> {
  const positions = fromSlots<CourtPoint>((slot) => slots[slot].point);
  return validateOverlap(positions, { ...options, phase });
}
