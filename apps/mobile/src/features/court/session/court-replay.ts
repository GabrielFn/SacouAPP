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
}

/** Runs a replay for real; the cache wraps it, and a test can wrap it to count the runs. */
export type ReplayRunner = (
  courtSessionId: string,
  events: readonly EventEnvelope[],
) => CourtReplayResult;

export const runCourtReplay: ReplayRunner = (courtSessionId, events) =>
  replayTimeline(
    { courtSessionId, initialState: INITIAL_COURT_SESSION_STATE, appliers: SCORE_APPLIERS },
    events,
  );

interface CacheEntry {
  readonly courtSessionId: string;
  readonly result: CourtReplayResult;
}

/**
 * The cache holds a value derived from an immutable array, never a second copy of the state: the
 * log is the source, and a new array (a new log) is a new key. The entry leaves with the array and
 * is used only for the stream it was computed for.
 */
export function createCourtReplayer(run: ReplayRunner = runCourtReplay): CourtReplayer {
  const cache = new WeakMap<readonly EventEnvelope[], CacheEntry>();
  return {
    replay(courtSessionId, events) {
      const cached = cache.get(events);
      if (cached?.courtSessionId === courtSessionId) {
        return cached.result;
      }
      const result = run(courtSessionId, events);
      cache.set(events, { courtSessionId, result });
      return result;
    },
  };
}
