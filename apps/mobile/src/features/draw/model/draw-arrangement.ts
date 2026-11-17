import type { MemberId } from "@sacou/match-engine";

import type { DrawTeamsAnswer } from "../../../services/api/sacou-api";

/**
 * The draw after the admin's swaps: the teams in order (1 is Laranja, 2 is Azul), each in order of arrival,
 * and the reserves in the order of the queue. The levels are the admin's, in whole tenths, kept only in
 * memory while screen 07 is open (ADR 0060): never cached, persisted, logged nor shared.
 */
export interface DrawArrangement {
  readonly teams: readonly (readonly MemberId[])[];
  readonly reserves: readonly MemberId[];
  readonly levels: ReadonlyMap<MemberId, number>;
}

/** A `together` pair: the only lock of the pilot (question 56). The order of the two does not matter. */
export interface DrawLock {
  readonly first: MemberId;
  readonly second: MemberId;
}

/** Where a member is in the arrangement: a team (by index) or a place in the queue of reserves. */
export type DrawPlace =
  | { readonly kind: "team"; readonly team: number; readonly index: number }
  | { readonly kind: "reserve"; readonly index: number };

/** The answer of the server as the screen keeps it: IDs in order and the levels by member. */
export function arrangementOf(answer: DrawTeamsAnswer): DrawArrangement {
  const sorted = [...answer.teams].sort((left, right) => left.number - right.number);
  const everyone = [...sorted.flatMap((team) => team.members), ...answer.reserves];
  return {
    teams: sorted.map((team) => team.members.map((member) => member.memberId)),
    reserves: answer.reserves.map((member) => member.memberId),
    levels: new Map(everyone.map((member) => [member.memberId, member.levelTenths] as const)),
  };
}

export function placeOf(arrangement: DrawArrangement, memberId: MemberId): DrawPlace | null {
  const reserve = arrangement.reserves.indexOf(memberId);
  if (reserve >= 0) return { kind: "reserve", index: reserve };
  const team = arrangement.teams.findIndex((members) => members.includes(memberId));
  return team < 0
    ? null
    : { kind: "team", team, index: arrangement.teams[team]?.indexOf(memberId) ?? -1 };
}

/** Everyone of the draw: the teams in order, then the reserves. */
export function membersOf(arrangement: DrawArrangement): readonly MemberId[] {
  return [...arrangement.teams.flat(), ...arrangement.reserves];
}

export function sameTeam(arrangement: DrawArrangement, lock: DrawLock): boolean {
  const first = placeOf(arrangement, lock.first);
  const second = placeOf(arrangement, lock.second);
  return first?.kind === "team" && second?.kind === "team" && first.team === second.team;
}

export function touches(lock: DrawLock, memberId: MemberId): boolean {
  return lock.first === memberId || lock.second === memberId;
}

export function sameLock(left: DrawLock, right: DrawLock): boolean {
  return (
    (left.first === right.first && left.second === right.second) ||
    (left.first === right.second && left.second === right.first)
  );
}

export function isLocked(locks: readonly DrawLock[], memberId: MemberId): boolean {
  return locks.some((lock) => touches(lock, memberId));
}
