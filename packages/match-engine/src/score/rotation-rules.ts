import type { SetterZone } from "@sacou/volley-rules";

import { SETTER_ZONE_SEQUENCE, TEAM_SIDES } from "./constants.data.js";
import type { MatchScore, MemberId, TeamRoster, TeamSide } from "./types.js";

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
export function getLineupBySlot(
  lineup: readonly MemberId[],
  setterZone: SetterZone,
): readonly MemberId[] {
  const rotationCount = SETTER_ZONE_SEQUENCE.indexOf(setterZone);
  return [...lineup.slice(rotationCount), ...lineup.slice(0, rotationCount)];
}

/** Who is in slot 1. The lineup has six members by the parser, so the entry always exists. */
export function getServingPlayer(lineup: readonly MemberId[], setterZone: SetterZone): MemberId {
  return lineup[SETTER_ZONE_SEQUENCE.indexOf(setterZone)] as MemberId;
}

/** Lineup and bench together hold each member of the team exactly once, and nobody else. */
export function isRosterPartition(
  lineup: readonly MemberId[],
  bench: readonly MemberId[],
  { memberIds }: TeamRoster,
): boolean {
  const allocated = [...lineup, ...bench];
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
