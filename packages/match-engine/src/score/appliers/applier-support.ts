// Shared steps of the score appliers, as ApplierSupport.cs in the C# port.
import { err, type Result } from "@sacou/volley-rules";

import type { EventRejection } from "../../event-log/types.js";
import { nextSetterZone } from "../rotation-rules.js";
import type {
  CourtSessionState,
  MatchScore,
  MatchSet,
  MatchTeams,
  MemberId,
  TeamRotations,
  TeamSide,
} from "../types.js";

export function rejected(): Result<never, EventRejection> {
  return err({ code: "event-rejected" });
}

export function findOpenMatch(state: CourtSessionState, matchId: string): MatchScore | null {
  const { currentMatch } = state;
  return currentMatch?.matchId === matchId ? currentMatch : null;
}

export function findOpenSet(match: MatchScore | null, setNumber: number): MatchSet | null {
  const currentSet = match?.currentSet ?? null;
  return currentSet?.setNumber === setNumber ? currentSet : null;
}

export function withCurrentMatch(state: CourtSessionState, match: MatchScore): CourtSessionState {
  return { currentMatch: match, finishedMatches: state.finishedMatches, queue: state.queue };
}

export function isFinishedMatchId(state: CourtSessionState, matchId: string): boolean {
  return state.finishedMatches.some((match) => match.matchId === matchId);
}

export function emptySet(setNumber: number, targetPoints: number, firstServer: TeamSide): MatchSet {
  return {
    firstServer,
    score: { a: 0, b: 0 },
    servingTeam: firstServer,
    setNumber,
    targetPoints,
  };
}

export function rotateTeam(rotations: TeamRotations, team: TeamSide): TeamRotations {
  const teamState = rotations[team];
  return teamState === null
    ? rotations
    : { ...rotations, [team]: { ...teamState, setterZone: nextSetterZone(teamState.setterZone) } };
}

export function isMatchMember({ a, b }: MatchTeams, memberId: MemberId): boolean {
  return a.memberIds.includes(memberId) || b.memberIds.includes(memberId);
}
