import { POINT_SCORED_EVENT_TYPE, type EventEnvelope } from "@sacou/match-engine";

/** The point a command just wrote, the one screen 31 asks about; `null` when it wrote none. */
export function scoredPointId(written: readonly EventEnvelope[]): string | null {
  return written.find(({ type }) => type === POINT_SCORED_EVENT_TYPE)?.eventId ?? null;
}
