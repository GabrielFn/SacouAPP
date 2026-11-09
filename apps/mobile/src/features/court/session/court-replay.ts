import {
  INITIAL_COURT_SESSION_STATE,
  replayTimeline,
  SCORE_APPLIERS,
  type CourtSessionTimeline,
  type EventEnvelope,
  type ReplayError,
} from "@sacou/match-engine";
import type { Result } from "@sacou/volley-rules";

export type CourtReplayResult = Result<CourtSessionTimeline, ReplayError>;

export interface CourtReplayer {
  /**
   * The timeline of a court session's events. Remembers the answer per array, so asking again for
   * the same array costs nothing: a tap simulates the new log once and the screen reads that result.
   */
  replay(courtSessionId: string, events: readonly EventEnvelope[]): CourtReplayResult;
  /** How many replays really ran, for the tests of the cache. */
  runs(): number;
}

/**
 * The cache holds a value derived from an immutable array, never a second copy of the state: the
 * log is the source, and a new array (a new log) is a new key. The entry leaves with the array.
 */
export function createCourtReplayer(): CourtReplayer {
  const cache = new WeakMap<readonly EventEnvelope[], CourtReplayResult>();
  const counter = { value: 0 };
  return {
    replay(courtSessionId, events) {
      const cached = cache.get(events);
      if (cached !== undefined) {
        return cached;
      }
      counter.value += 1;
      const result = replayTimeline(
        { courtSessionId, initialState: INITIAL_COURT_SESSION_STATE, appliers: SCORE_APPLIERS },
        events,
      );
      cache.set(events, result);
      return result;
    },
    runs: () => counter.value,
  };
}
