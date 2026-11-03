import type { TimelineEntry } from "../event-log/types.js";
import type { CourtSessionTimeline } from "../corrections/types.js";
import { POINT_ATTRIBUTED_EVENT_TYPE, POINT_SCORED_EVENT_TYPE } from "../score/constants.data.js";
import { parsePointAttributedPayload, parsePointScoredPayload } from "../score/parse-payloads.js";
import type {
  CourtSessionState,
  PointAttributedPayload,
  TeamRoster,
  TeamSide,
} from "../score/types.js";
import type { PointAttribution } from "./types.js";

type Entry = TimelineEntry<CourtSessionState>;

/** An active point, with the frozen team that scored it. */
interface ScoredPoint {
  readonly eventId: string;
  readonly matchId: string;
  readonly setNumber: number;
  readonly team: TeamSide;
  readonly roster: TeamRoster;
}

/** The state after a point always has its match open, because the applier accepted it there. */
function scoredPointOf({ event, state }: Entry): readonly ScoredPoint[] {
  if (event.type !== POINT_SCORED_EVENT_TYPE) {
    return [];
  }
  const parsed = parsePointScoredPayload(event.payload);
  const match = state.currentMatch;
  if (!parsed.ok || match === null || match.matchId !== parsed.value.matchId) {
    return [];
  }
  const { matchId, setNumber, team } = parsed.value;
  return [{ eventId: event.eventId, matchId, setNumber, team, roster: match.teams[team] }];
}

function attributionOf({ event }: Entry): readonly PointAttributedPayload[] {
  if (event.type !== POINT_ATTRIBUTED_EVENT_TYPE) {
    return [];
  }
  const parsed = parsePointAttributedPayload(event.payload);
  return parsed.ok ? [parsed.value] : [];
}

/**
 * The point must be active and of the same match, and the author of the team that scored it. The
 * court of the rally is not checked again: the recorded choice stands (ADR 0031).
 */
function isValidFor(point: ScoredPoint | undefined, attribution: PointAttributedPayload): boolean {
  const { author, matchId } = attribution;
  return (
    point !== undefined &&
    point.matchId === matchId &&
    (author === null || point.roster.memberIds.includes(author))
  );
}

function toPointAttribution(
  { eventId, matchId, setNumber, team }: ScoredPoint,
  { author, kind }: PointAttributedPayload,
): PointAttribution {
  return { pointEventId: eventId, matchId, setNumber, team, kind, author };
}

/**
 * Who scored each active point of the timeline, in the order of the points, and only the points
 * with a valid attribution. The last valid `PointAttributed` in the canonical order wins, wherever it
 * is in relation to the point, because two writers may record them in any order. An invalid one is
 * ignored, as if it did not exist. Linear: a `Map` of points and a `Map` of attributions, where the
 * last entry of a key wins.
 */
export function resolvePointAttributions({
  entries,
}: CourtSessionTimeline): readonly PointAttribution[] {
  const points = entries.flatMap(scoredPointOf);
  const pointsById = new Map(points.map((point) => [point.eventId, point]));
  const validAttributions = entries
    .flatMap(attributionOf)
    .filter((attribution) => isValidFor(pointsById.get(attribution.pointEventId), attribution));
  const latestByPoint = new Map(
    validAttributions.map((attribution) => [attribution.pointEventId, attribution]),
  );
  return points.flatMap((point) => {
    const attribution = latestByPoint.get(point.eventId);
    return attribution === undefined ? [] : [toPointAttribution(point, attribution)];
  });
}
