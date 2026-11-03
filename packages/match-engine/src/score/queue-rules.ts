import type { TeamQueue, MatchTeams, MemberId } from "./types.js";

/** Everyone waiting, teams first and then players, each one once by the parser. */
export function queueMembers({ players, teams }: TeamQueue): readonly MemberId[] {
  return [...teams.flatMap(({ memberIds }) => memberIds), ...players];
}

export function queueSize(queue: TeamQueue): number {
  return queueMembers(queue).length;
}

/**
 * Whether anyone waiting is on the court: the queue is checked against the frozen `teams`, the one
 * of the payload or the one of the open match (ADR 0029).
 */
export function isQueueOverlappingTeams(queue: TeamQueue, { a, b }: MatchTeams): boolean {
  return queueMembers(queue).some((id) => a.memberIds.includes(id) || b.memberIds.includes(id));
}
