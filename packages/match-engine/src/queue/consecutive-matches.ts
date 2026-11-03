import type { CourtSessionState, FinishedMatch, MemberId } from "../score/types.js";

const NOT_FOUND = -1;

/** In the team at all, on the bench and as the libero too, and whatever the end or the winner. */
function hasPlayed({ teams }: FinishedMatch, memberId: MemberId): boolean {
  return teams.a.memberIds.includes(memberId) || teams.b.memberIds.includes(memberId);
}

/**
 * How many finished matches in a row, ending with the last one, had the member in a team. The open
 * match does not count, and a `RevertedTo` undoes the count with the state (ADR 0029).
 */
export function getConsecutiveMatches(state: CourtSessionState, memberId: MemberId): number {
  const newestFirst = [...state.finishedMatches].reverse();
  const firstMissed = newestFirst.findIndex((match) => !hasPlayed(match, memberId));
  return firstMissed === NOT_FOUND ? newestFirst.length : firstMissed;
}

/** How many finished matches of the round had the member in a team, in a row or not. */
export function getMatchesPlayed(state: CourtSessionState, memberId: MemberId): number {
  return state.finishedMatches.filter((match) => hasPlayed(match, memberId)).length;
}
