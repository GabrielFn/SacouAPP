import type { SetterZone } from "@sacou/volley-rules";

import { resolvePointAttributions } from "../attributions/resolve.js";
import type { PointAttribution } from "../attributions/types.js";
import type { TimelineEntry } from "../event-log/types.js";
import { MATCH_STARTED_EVENT_TYPE, POINT_SCORED_EVENT_TYPE } from "../score/constants.data.js";
import { parsePointScoredPayload } from "../score/parse-payloads.js";
import { getCurrentServingPlayer, isSideOut } from "../score/rotation-rules.js";
import type { CourtSessionState, MatchScore, MatchSet, TeamSide } from "../score/types.js";
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

type AttributionsByPoint = ReadonlyMap<string, PointAttribution>;

interface ListedSet {
  readonly matchId: string;
  readonly setNumber: number;
}

/** The team that scored the event, when it is a point of the listed set; otherwise `null`. */
function readListedPointTeam(
  event: Entry["event"],
  { matchId, setNumber }: ListedSet,
): TeamSide | null {
  if (event.type !== POINT_SCORED_EVENT_TYPE) {
    return null;
  }
  const parsed = parsePointScoredPayload(event.payload);
  if (!parsed.ok) {
    return null;
  }
  const isListed = parsed.value.matchId === matchId && parsed.value.setNumber === setNumber;
  return isListed ? parsed.value.team : null;
}

interface PointSets {
  readonly matchBefore: MatchScore;
  readonly setBefore: MatchSet;
  readonly setAfter: MatchSet;
}

/** The match and set before the point and the set after it, when all of them are open. */
function readPointSets(before: CourtSessionState, after: CourtSessionState): PointSets | null {
  const matchBefore = before.currentMatch;
  const setBefore = matchBefore?.currentSet ?? null;
  const setAfter = after.currentMatch?.currentSet ?? null;
  return matchBefore === null || setBefore === null || setAfter === null
    ? null
    : { matchBefore, setBefore, setAfter };
}

function setterZoneAfter(state: CourtSessionState, team: TeamSide): SetterZone | null {
  return state.currentMatch?.rotations[team]?.setterZone ?? null;
}

function authorshipOf(
  attribution: PointAttribution | undefined,
): Pick<RecentPoint, "author" | "kind"> {
  return { author: attribution?.author ?? null, kind: attribution?.kind ?? null };
}

function toRecentPoint(
  before: CourtSessionState,
  { event, state }: Entry,
  listed: ListedSet,
  attributions: AttributionsByPoint,
): RecentPoint | null {
  const team = readListedPointTeam(event, listed);
  const sets = readPointSets(before, state);
  if (team === null || sets === null) {
    return null;
  }
  const { matchBefore, setBefore, setAfter } = sets;
  const sideOut = isSideOut(setBefore.servingTeam, team);
  return {
    eventId: event.eventId,
    team,
    score: setAfter.score,
    servingTeam: setBefore.servingTeam,
    servingPlayer: getCurrentServingPlayer(matchBefore),
    sideOut,
    setterZone: sideOut ? setterZoneAfter(state, team) : null,
    ...authorshipOf(attributions.get(event.eventId)),
  };
}

function isCount(value: number): boolean {
  return Number.isSafeInteger(value) && value >= 0;
}

/**
 * The active points of the listed set, oldest first, each with who scored it. A point that was
 * reverted is not on the timeline, so it is not listed. Without an open match, the list is empty.
 */
export function getListedSetPoints(timeline: CourtSessionTimeline): readonly RecentPoint[] {
  const match = getOpenMatch(timeline);
  const setNumber = match === null ? null : listedSetNumber(match);
  if (match === null || setNumber === null) {
    return [];
  }
  const attributions: AttributionsByPoint = new Map(
    resolvePointAttributions(timeline).map((attribution) => [
      attribution.pointEventId,
      attribution,
    ]),
  );
  const listed = { matchId: match.matchId, setNumber };
  const { entries } = timeline;
  const start = getOpenMatchStartIndex(timeline);
  return entries.slice(start + 1).flatMap((entry, offset) => {
    const before = entries[start + offset]?.state;
    const point = before === undefined ? null : toRecentPoint(before, entry, listed, attributions);
    return point === null ? [] : [point];
  });
}

/**
 * The active points of the set of screen 24, most recent first, up to `limit`. Without an open
 * match, or with a `limit` that is not a count, the list is empty.
 */
export function getRecentPoints(
  timeline: CourtSessionTimeline,
  limit: number = CORRECTION_TIMELINE_POINTS,
): readonly RecentPoint[] {
  return isCount(limit) ? [...getListedSetPoints(timeline)].reverse().slice(0, limit) : [];
}
