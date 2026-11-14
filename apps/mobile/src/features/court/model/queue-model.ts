import type { MemberId, TeamQueue } from "@sacou/match-engine";

import type { CourtRoster } from "../ports/court-roster";
import type { QueueModel } from "./court-screen.types";

/** `null` when nobody waits: the queue strip shows nothing about it. */
export function selectQueue(queue: TeamQueue, roster: CourtRoster): QueueModel | null {
  if (queue.teams.length === 0 && queue.players.length === 0) {
    return null;
  }
  const players = (members: readonly MemberId[]) =>
    members.map((memberId) => ({
      memberId,
      name: roster.nameOf(memberId),
      displayName: roster.nameOf(memberId),
    }));
  return {
    teams: queue.teams.map((team) => ({
      key: team.memberIds.join(),
      players: players(team.memberIds),
    })),
    players: players(queue.players),
    exit: queue.teams.length === 0 ? "partial" : "full",
  };
}
