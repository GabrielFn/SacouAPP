import type { TimelineEntry } from "../event-log/types.js";
import { MATCH_STARTED_EVENT_TYPE, POINT_SCORED_EVENT_TYPE } from "../score/constants.data.js";
import { parsePointScoredPayload } from "../score/parse-payloads.js";
import { getCurrentServingPlayer, isSideOut } from "../score/rotation-rules.js";
import type { CourtSessionState, MatchScore } from "../score/types.js";
import { CORRECTION_TIMELINE_POINTS } from "./constants.data.js";
import type { CourtSessionTimeline, RecentPoint } from "./types.js";

type Entry = TimelineEntry<CourtSessionState>;

const NOT_FOUND = -1;

/** The match open at the end of the timeline, or `null`. */
export function getOpenMatch({ entries }: CourtSessionTimeline): MatchScore | null {
  return entries.at(-1)?.state.currentMatch ?? null;
}

/**
 * Where the open match starts: the last active `MatchStarted`, since a match opens only when none is
 * open. `NOT_FOUND` without one.
 */
export function getOpenMatchStartIndex({ entries }: CourtSessionTimeline): number {
  return entries.reduce(
    (found, { event }, index) => (event.type === MATCH_STARTED_EVENT_TYPE ? index : found),
    NOT_FOUND,
  );
}

/** The set the list shows: the open one, or the last one played while the match is pending. */
function listedSetNumber({ completedSets, currentSet }: MatchScore): number | null {
  return currentSet?.setNumber ?? completedSets.at(-1)?.setNumber ?? null;
}

function toRecentPoint(
  before: CourtSessionState,
  { event, state }: Entry,
  matchId: string,
  setNumber: number,
): RecentPoint | null {
  if (event.type !== POINT_SCORED_EVENT_TYPE) {
    return null;
  }
  const parsed = parsePointScoredPayload(event.payload);
  const matchBefore = before.currentMatch;
  const setBefore = matchBefore?.currentSet ?? null;
  const setAfter = state.currentMatch?.currentSet ?? null;
  if (!parsed.ok || matchBefore === null || setBefore === null || setAfter === null) {
    return null;
  }
  const { team } = parsed.value;
  if (parsed.value.matchId !== matchId || parsed.value.setNumber !== setNumber) {
    return null;
  }
  const sideOut = isSideOut(setBefore.servingTeam, team);
  return {
    eventId: event.eventId,
    team,
    score: setAfter.score,
    servingTeam: setBefore.servingTeam,
    servingPlayer: getCurrentServingPlayer(matchBefore),
    sideOut,
    setterZone: sideOut ? (state.currentMatch?.rotations[team]?.setterZone ?? null) : null,
  };
}

function isCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * The active points of the set of screen 24, most recent first, up to `limit`. A point that was
 * reverted is not on the timeline, so it is not listed. Without an open match, or with a `limit`
 * that is not a count, the list is empty.
 */
export function getRecentPoints(
  timeline: CourtSessionTimeline,
  limit: number = CORRECTION_TIMELINE_POINTS,
): readonly RecentPoint[] {
  const match = getOpenMatch(timeline);
  const setNumber = match === null ? null : listedSetNumber(match);
  if (match === null || setNumber === null || !isCount(limit)) {
    return [];
  }
  const { entries } = timeline;
  const start = getOpenMatchStartIndex(timeline);
  const points = entries.slice(start + 1).flatMap((entry, offset) => {
    const before = entries[start + offset]?.state;
    const point =
      before === undefined ? null : toRecentPoint(before, entry, match.matchId, setNumber);
    return point === null ? [] : [point];
  });
  return [...points].reverse().slice(0, limit);
}
