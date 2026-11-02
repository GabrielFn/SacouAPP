import type { PayloadShape, ScoreEventType } from "./types.js";

export const MATCH_STARTED_EVENT_TYPE = "MatchStarted";
export const POINT_SCORED_EVENT_TYPE = "PointScored";
export const SET_ENDED_EVENT_TYPE = "SetEnded";
export const MATCH_ENDED_EVENT_TYPE = "MatchEnded";

export const CURRENT_RULES_VERSION = 1;

/** Only commands check this: the replay accepts any version, because the result is recorded. */
export const SUPPORTED_RULES_VERSIONS: readonly number[] = [CURRENT_RULES_VERSION];

export const TEAM_SIDES = ["a", "b"] as const;
export const BEST_OF_VALUES = [1, 3, 5] as const;
export const WIN_MARGIN_VALUES = [1, 2] as const;
export const END_REASONS = ["sets-won", "manual"] as const;

/** Half of the sets, rounded up, wins the match. */
export const MAJORITY_DIVISOR = 2;

/** Technical limit: the scoreboard shows two digits. */
export const MIN_SET_POINTS = 1;
export const MAX_SET_POINTS = 99;

export const FIRST_SET_NUMBER = 1;
export const LAST_SET_NUMBER = 5;

/** Technical limit: above any team with a bench. */
export const MIN_TEAM_MEMBERS = 1;
export const MAX_TEAM_MEMBERS = 24;

/**
 * Technical limit, not a volleyball rule: a real round stays near 30 matches. The state copies and
 * searches this list at each match, so a hostile log must not make it grow. 200 finished matches
 * can exist; a new `MatchStarted` with 200 finished is rejected.
 */
export const MAX_FINISHED_MATCHES = 200;

/** Reported when the input as a whole is not a payload object. */
export const PAYLOAD_ROOT_FIELD = "payload";

/** Reported instead of the name of an unknown key, which is received data and may be personal. */
export const UNKNOWN_PAYLOAD_FIELD = "unknown-field";

/** The closed schema of each payload: `null` marks a leaf, and anything else is rejected. */
export const SCORE_PAYLOAD_SHAPES: Readonly<Record<ScoreEventType, PayloadShape>> = {
  [MATCH_STARTED_EVENT_TYPE]: {
    matchId: null,
    rulesVersion: null,
    scoring: { bestOf: null, pointsPerSet: null, tieBreakPoints: null, winMargin: null },
    teams: { a: { memberIds: null }, b: { memberIds: null } },
  },
  [POINT_SCORED_EVENT_TYPE]: { matchId: null, setNumber: null, team: null },
  [SET_ENDED_EVENT_TYPE]: {
    matchId: null,
    setNumber: null,
    winner: null,
    nextSet: { targetPoints: null },
  },
  [MATCH_ENDED_EVENT_TYPE]: { matchId: null, endReason: null, winner: null },
};
