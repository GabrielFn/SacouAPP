import {
  getRecentPoints,
  POINT_SCORED_EVENT_TYPE,
  type CourtSessionTimeline,
  type EventEnvelope,
} from "@sacou/match-engine";

import { selectCourtPhase, stateOfTimeline } from "../model/court-screen.selectors";

/** The point a command just wrote, the one screen 31 asks about; `null` when it wrote none. */
export function scoredPointId(written: readonly EventEnvelope[]): string | null {
  return written.find(({ type }) => type === POINT_SCORED_EVENT_TYPE)?.eventId ?? null;
}

/**
 * Over the court, screen 31 asks only about the newest point of the set in play: it stays open until
 * the next point, and a point that decided the set is asked about on screen 25 instead ("Preencher").
 */
export function asksOverTheCourt(timeline: CourtSessionTimeline, pointEventId: string): boolean {
  return (
    selectCourtPhase(stateOfTimeline(timeline)) === "playing" &&
    getRecentPoints(timeline)[0]?.eventId === pointEventId
  );
}
