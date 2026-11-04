import { err, type Result } from "@sacou/volley-rules";

import type { EventRejection } from "../event-log/types.js";
import type { CourtSessionState, MatchScore, MatchSet } from "./types.js";

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
