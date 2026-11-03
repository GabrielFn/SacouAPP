import { getListedSetPoints } from "../corrections/timeline.js";
import type { CourtSessionTimeline, RecentPoint } from "../corrections/types.js";

/**
 * The active points of the listed set that nobody answered yet, oldest first, for the end of the
 * set: an error of the opponent is an answer, so it is not here. Without an open match, none.
 */
export function getUnattributedPoints(timeline: CourtSessionTimeline): readonly RecentPoint[] {
  return getListedSetPoints(timeline).filter(({ kind }) => kind === null);
}
