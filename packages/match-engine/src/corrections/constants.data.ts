import {
  LINEUP_CHANGED_EVENT_TYPE,
  POINT_ATTRIBUTED_EVENT_TYPE,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
} from "../score/constants.data.js";
import type { RemovedActionKey } from "./types.js";

/** The points screen 24 lists, most recent first. */
export const CORRECTION_TIMELINE_POINTS = 10;

/**
 * What each event type counts as in a revert preview. A `Map`, because the type comes from the log:
 * an inherited key of a plain object must never count. The open match has no `MatchStarted` nor
 * `MatchEnded` after the target, so they are not here.
 */
export const REMOVED_ACTION_KEYS: ReadonlyMap<string, RemovedActionKey> = new Map([
  [POINT_SCORED_EVENT_TYPE, "points"],
  [LINEUP_CHANGED_EVENT_TYPE, "lineupChanges"],
  [QUEUE_CHANGED_EVENT_TYPE, "queueChanges"],
  [SERVING_TEAM_CHANGED_EVENT_TYPE, "servingChanges"],
  [SET_ENDED_EVENT_TYPE, "setEnds"],
  [POINT_ATTRIBUTED_EVENT_TYPE, "attributions"],
]);
