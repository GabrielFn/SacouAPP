import type { EventEnvelope } from "../event-log/types.js";
import { POINT_SCORED_EVENT_TYPE } from "./constants.data.js";
import { parsePointScoredPayload } from "./parse-payloads.js";
import type { PointScoredPayload } from "./types.js";

/** The payload of a `PointScored` event; `null` for another type or a payload out of the format. */
export function readPointScored(event: EventEnvelope): PointScoredPayload | null {
  if (event.type !== POINT_SCORED_EVENT_TYPE) {
    return null;
  }
  const parsed = parsePointScoredPayload(event.payload);
  return parsed.ok ? parsed.value : null;
}
