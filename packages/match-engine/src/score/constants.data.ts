import type { FormationSystem, PlayerRole, SetterZone } from "@sacou/volley-rules";

import type { PayloadShape, ScoreEventType, ZoneFormation } from "./types.js";

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

/**
 * The order a team goes through when it rotates. A literal, not read from the formations catalog:
 * editing a formation must never change the replay of a recorded match (ADR 0024).
 */
export const SETTER_ZONE_SEQUENCE = [1, 6, 5, 4, 3, 2] as const satisfies readonly SetterZone[];

/**
 * This table is the `IRotationSystem` of ADR 0011: the systems differ only in data, so there is no
 * class. The 6x2 and the 4x2 play three formations twice, with the pairs swapped (ADR 0026).
 */
export const ZONE_FORMATIONS: Readonly<
  Record<FormationSystem, Readonly<Record<SetterZone, ZoneFormation>>>
> = {
  "5x1": {
    1: { formationKey: 1, swapPairs: false },
    6: { formationKey: 6, swapPairs: false },
    5: { formationKey: 5, swapPairs: false },
    4: { formationKey: 4, swapPairs: false },
    3: { formationKey: 3, swapPairs: false },
    2: { formationKey: 2, swapPairs: false },
  },
  "6x2": {
    1: { formationKey: 1, swapPairs: false },
    6: { formationKey: 6, swapPairs: false },
    5: { formationKey: 5, swapPairs: false },
    4: { formationKey: 1, swapPairs: true },
    3: { formationKey: 6, swapPairs: true },
    2: { formationKey: 5, swapPairs: true },
  },
  "4x2": {
    1: { formationKey: 4, swapPairs: false },
    6: { formationKey: 3, swapPairs: false },
    5: { formationKey: 2, swapPairs: false },
    4: { formationKey: 4, swapPairs: true },
    3: { formationKey: 3, swapPairs: true },
    2: { formationKey: 2, swapPairs: true },
  },
  livre: {
    1: { formationKey: 0, swapPairs: false },
    6: { formationKey: 0, swapPairs: false },
    5: { formationKey: 0, swapPairs: false },
    4: { formationKey: 0, swapPairs: false },
    3: { formationKey: 0, swapPairs: false },
    2: { formationKey: 0, swapPairs: false },
  },
};

/** Only the label changes in a swap: the point stays the one of the formation. */
export const SWAPPED_PAIR_ROLES: Readonly<Partial<Record<PlayerRole, PlayerRole>>> = {
  S1: "S2",
  S2: "S1",
  OH1: "OH2",
  OH2: "OH1",
  MB1: "MB2",
  MB2: "MB1",
};

/**
 * Who sets, by role in the formation and before any swap: the 6x2 sets from the back row, the 4x2
 * from the net, and in the free system whoever stands in position 3.
 */
export const ACTING_SETTER_ROLES: Readonly<Record<FormationSystem, PlayerRole>> = {
  "5x1": "S",
  "6x2": "S1",
  "4x2": "S2",
  livre: "P3",
};

/** The role of the libero in the formations, which a team with the libero off never shows. */
export const LIBERO_ROLE: PlayerRole = "L";

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
    formationsVersion: null,
    scoring: { bestOf: null, pointsPerSet: null, tieBreakPoints: null, winMargin: null },
    teams: { a: { memberIds: null }, b: { memberIds: null } },
    firstServer: null,
    rotations: {
      a: { lineup: null, setterZone: null, system: null },
      b: { lineup: null, setterZone: null, system: null },
    },
  },
  [POINT_SCORED_EVENT_TYPE]: { matchId: null, setNumber: null, team: null },
  [SET_ENDED_EVENT_TYPE]: {
    matchId: null,
    setNumber: null,
    winner: null,
    nextSet: { targetPoints: null, firstServer: null, setterZones: { a: null, b: null } },
  },
  [MATCH_ENDED_EVENT_TYPE]: { matchId: null, endReason: null, winner: null },
};
