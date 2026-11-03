import type { CourtQueue, MatchTeams, MemberId } from "./types.js";

/** Everyone waiting, teams first and then players, each one once by the parser. */
export function queueMembers({ players, teams }: CourtQueue): readonly MemberId[] {
  return [...teams.flatMap(({ memberIds }) => memberIds), ...players];
}

export function queueSize(queue: CourtQueue): number {
  return queueMembers(queue).length;
}

/**
 * Whether anyone waiting is on the court: the queue is checked against the frozen `teams`, the one
 * of the payload or the one of the open match (ADR 0029).
 */
export function isQueueOverlappingTeams(queue: CourtQueue, { a, b }: MatchTeams): boolean {
  return queueMembers(queue).some((id) => a.memberIds.includes(id) || b.memberIds.includes(id));
}
