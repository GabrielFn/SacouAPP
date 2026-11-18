import type { CourtSessionTimeline } from "../corrections/types.js";
import { POINT_SCORED_EVENT_TYPE } from "../score/constants.data.js";
import { parsePointScoredPayload } from "../score/parse-payloads.js";
import type { RefusedPoint, RefusedPointsInput } from "./types.js";

/**
 * The points this device marked that the server did not store after a takeover (ADR 0063, D11): its
 * `PointScored` events past the last sequence the server stored, still active on the local timeline,
 * oldest first. A point marked and then undone in the same log is not on the timeline, so it is not
 * counted; any other event type and the events of other devices are not points of this phone.
 */
export function refusedPoints(
  timeline: CourtSessionTimeline,
  { deviceId, lastStoredSequence }: RefusedPointsInput,
): readonly RefusedPoint[] {
  return timeline.entries.flatMap(({ event }) => {
    const isOwnUnstoredPoint =
      event.type === POINT_SCORED_EVENT_TYPE &&
      event.deviceId === deviceId &&
      event.sequence > lastStoredSequence;
    const parsed = isOwnUnstoredPoint ? parsePointScoredPayload(event.payload) : null;
    return parsed?.ok === true ? [{ eventId: event.eventId, team: parsed.value.team }] : [];
  });
}
