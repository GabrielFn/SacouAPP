// Score events and their payloads, with the errors of parsing them.
import type {
  LINEUP_CHANGED_EVENT_TYPE,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  PAYLOAD_ROOT_FIELD,
  POINT_ATTRIBUTED_EVENT_TYPE,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  SERVING_TEAM_CHANGED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
  UNKNOWN_PAYLOAD_FIELD,
} from "../constants.data.js";
import type {
  LineupAllocation,
  MatchEndReason,
  MatchTeams,
  MemberId,
  PointKind,
  ScoringRules,
  SetterZones,
  TeamQueue,
  TeamRotations,
  TeamSide,
} from "./team.js";

export type ScoreEventType =
  | typeof MATCH_STARTED_EVENT_TYPE
  | typeof POINT_SCORED_EVENT_TYPE
  | typeof SET_ENDED_EVENT_TYPE
  | typeof MATCH_ENDED_EVENT_TYPE
  | typeof LINEUP_CHANGED_EVENT_TYPE
  | typeof QUEUE_CHANGED_EVENT_TYPE
  | typeof SERVING_TEAM_CHANGED_EVENT_TYPE
  | typeof POINT_ATTRIBUTED_EVENT_TYPE;

export interface MatchStartedPayload {
  readonly firstServer: TeamSide;
  readonly formationsVersion: number;
  readonly matchId: string;
  /** The queue once this match starts: the result of the exit, recorded whole (ADR 0029). */
  readonly queue: TeamQueue;
  readonly rotations: TeamRotations;
  readonly rulesVersion: number;
  readonly scoring: ScoringRules;
  readonly teams: MatchTeams;
}

/**
 * Records no absolute score and no rotation: two interleaved writers would otherwise lock the stream.
 * The side-out is derived from the state, and that transition is part of what this event means in
 * schema 1 (ADR 0024).
 */
export interface PointScoredPayload {
  readonly matchId: string;
  readonly setNumber: number;
  readonly team: TeamSide;
}

export interface NextSet {
  readonly firstServer: TeamSide;
  readonly setterZones: SetterZones;
  readonly targetPoints: number;
}

export interface SetEndedPayload {
  readonly matchId: string;
  readonly nextSet: NextSet | null;
  readonly setNumber: number;
  readonly winner: TeamSide;
}

export interface MatchEndedPayload {
  readonly endReason: MatchEndReason;
  readonly matchId: string;
  readonly winner: TeamSide | null;
}

/**
 * Records the whole allocation of the team, never the change: it has no `setNumber`, and it is
 * checked against the frozen `teams`, so points of another writer in between do not reject it.
 */
export interface LineupChangedPayload extends LineupAllocation {
  readonly matchId: string;
  readonly team: TeamSide;
}

/** The whole queue, for whoever arrives or leaves during an open match; the last one wins. */
export interface QueueChangedPayload {
  readonly matchId: string;
  readonly queue: TeamQueue;
}

/**
 * A correction of who serves in the open set, recorded whole: the command decides both fields, and
 * nobody rotates. `firstServer` changes only when the set had no points yet (ADR 0030).
 */
export interface ServingTeamChangedPayload {
  readonly firstServer: TeamSide;
  readonly matchId: string;
  readonly servingTeam: TeamSide;
  readonly setNumber: number;
}

/**
 * Who scored a point already recorded, and how: "De quem foi?", at once or later. It records the
 * choice as it came and nothing derived. `author` is `null` only for an error of the opponent; a
 * point without any answer has no event at all (ADR 0031).
 */
export interface PointAttributedPayload {
  readonly author: MemberId | null;
  readonly kind: PointKind;
  readonly matchId: string;
  readonly pointEventId: string;
}

export type ScorePayload =
  | MatchStartedPayload
  | PointScoredPayload
  | SetEndedPayload
  | MatchEndedPayload
  | LineupChangedPayload
  | QueueChangedPayload
  | ServingTeamChangedPayload
  | PointAttributedPayload;

/**
 * The key tree of a closed payload schema: `null` marks a leaf, and a one-item tuple marks a list
 * whose items all have that shape.
 */
export interface PayloadShape {
  readonly [key: string]: PayloadShape | readonly [PayloadShape] | null;
}

export type ScorePayloadField =
  | typeof PAYLOAD_ROOT_FIELD
  | typeof UNKNOWN_PAYLOAD_FIELD
  | "matchId"
  | "rulesVersion"
  | "formationsVersion"
  | "scoring"
  | "scoring.bestOf"
  | "scoring.pointsPerSet"
  | "scoring.tieBreakPoints"
  | "scoring.winMargin"
  | "teams"
  | "teams.a"
  | "teams.a.memberIds"
  | "teams.b"
  | "teams.b.memberIds"
  | "firstServer"
  | "rotations"
  | "rotations.a"
  | "rotations.a.lineup"
  | "rotations.a.setterZone"
  | "rotations.a.system"
  | "rotations.a.bench"
  | "rotations.a.libero"
  | "rotations.b"
  | "rotations.b.lineup"
  | "rotations.b.setterZone"
  | "rotations.b.system"
  | "rotations.b.bench"
  | "rotations.b.libero"
  | "setNumber"
  | "team"
  | "winner"
  | "nextSet"
  | "nextSet.targetPoints"
  | "nextSet.firstServer"
  | "nextSet.setterZones"
  | "nextSet.setterZones.a"
  | "nextSet.setterZones.b"
  | "endReason"
  | "lineup"
  | "setterZone"
  | "bench"
  | "libero"
  | "queue"
  | "queue.teams"
  | "queue.players"
  | "servingTeam"
  | "pointEventId"
  | "kind"
  | "author";

/** Carries only a path from the schema, never a received key or value. */
export interface ScorePayloadError {
  readonly code: "invalid-payload";
  readonly field: ScorePayloadField;
}
