import type { EventApplier } from "../event-log/types.js";
import { applyMatchEnded, applyMatchStarted } from "./appliers/match-appliers.js";
import {
  applyPointScored,
  applyServingTeamChanged,
  applySetEnded,
} from "./appliers/set-appliers.js";
import {
  applyLineupChanged,
  applyPointAttributed,
  applyQueueChanged,
} from "./appliers/team-appliers.js";
import {
  LINEUP_CHANGED_EVENT_TYPE,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  POINT_ATTRIBUTED_EVENT_TYPE,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
} from "./constants.data.js";
import type { CourtSessionState } from "./types.js";

export const INITIAL_COURT_SESSION_STATE: CourtSessionState = Object.freeze({
  currentMatch: null,
  finishedMatches: Object.freeze([]),
  queue: Object.freeze({ players: Object.freeze([]), teams: Object.freeze([]) }),
});

export const SCORE_APPLIERS: ReadonlyMap<string, EventApplier<CourtSessionState>> = new Map([
  [MATCH_STARTED_EVENT_TYPE, applyMatchStarted],
  [POINT_SCORED_EVENT_TYPE, applyPointScored],
  [SET_ENDED_EVENT_TYPE, applySetEnded],
  [MATCH_ENDED_EVENT_TYPE, applyMatchEnded],
  [LINEUP_CHANGED_EVENT_TYPE, applyLineupChanged],
  [QUEUE_CHANGED_EVENT_TYPE, applyQueueChanged],
  [SERVING_TEAM_CHANGED_EVENT_TYPE, applyServingTeamChanged],
  [POINT_ATTRIBUTED_EVENT_TYPE, applyPointAttributed],
]);
