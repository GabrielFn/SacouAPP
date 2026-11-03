import type {
  CourtPoint,
  FormationPhase,
  FormationSystem,
  PlayerRole,
  Result,
  RotationKey,
  RotationSlot,
  SetterZone,
} from "@sacou/volley-rules";

import type {
  BEST_OF_VALUES,
  END_REASONS,
  LINEUP_CHANGED_EVENT_TYPE,
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  PAYLOAD_ROOT_FIELD,
  POINT_SCORED_EVENT_TYPE,
  QUEUE_CHANGED_EVENT_TYPE,
  ROTATION_DIRECTIONS,
  SET_ENDED_EVENT_TYPE,
  TEAM_SIDES,
  UNKNOWN_PAYLOAD_FIELD,
  WIN_MARGIN_VALUES,
} from "./constants.data.js";

export type ScoreEventType =
  | typeof MATCH_STARTED_EVENT_TYPE
  | typeof POINT_SCORED_EVENT_TYPE
  | typeof SET_ENDED_EVENT_TYPE
  | typeof MATCH_ENDED_EVENT_TYPE
  | typeof LINEUP_CHANGED_EVENT_TYPE
  | typeof QUEUE_CHANGED_EVENT_TYPE;

/** A lowercase UUID. Where this type lives is decided in E3.2. */
export type MemberId = string;

export type TeamSide = (typeof TEAM_SIDES)[number];
export type BestOf = (typeof BEST_OF_VALUES)[number];
export type WinMargin = (typeof WIN_MARGIN_VALUES)[number];
export type MatchEndReason = (typeof END_REASONS)[number];
export type RotationDirection = (typeof ROTATION_DIRECTIONS)[number];

export interface ScoringRules {
  readonly bestOf: BestOf;
  readonly pointsPerSet: number;
  /** `null` turns the tie-break off. */
  readonly tieBreakPoints: number | null;
  /** 2 means advantage; 1 means none. It also applies to the tie-break. */
  readonly winMargin: WinMargin;
}

export interface TeamRoster {
  readonly memberIds: readonly MemberId[];
}

export interface MatchTeams {
  readonly a: TeamRoster;
  readonly b: TeamRoster;
}

/** Points in a set. */
export interface SetScore {
  readonly a: number;
  readonly b: number;
}

/** Sets won in a match. */
export interface SetsWon {
  readonly a: number;
  readonly b: number;
}

/**
 * The libero of a team and the positions it covers, by index of `lineup` and never by `MemberId`: one
 * index, or two on a diagonal in ascending order, never of a setter. Who stands in the court at each
 * moment is derived from `setterZone` and the phase, never recorded (ADR 0028).
 */
export interface TeamLibero {
  readonly memberId: MemberId;
  readonly replacedIndexes: readonly number[];
}

/**
 * The part of a team that changes during a match; `teams` stays the frozen copy of the event.
 * `lineup` has six members anchored on the setter: `lineup[0]` is the setter and the others follow
 * in ascending position, so a rotation only changes `setterZone`. In the free system, which has no
 * setter, `setterZone` is the zone of the first member of the lineup. The order of the lineup also
 * gives each member a role: `S, OH1, MB1, OPP, OH2, MB2` in the 5x1 and `S1, OH1, MB1, S2, OH2, MB2`
 * in the 6x2 and the 4x2 (ADR 0026). `bench` is whoever of the team is not in the lineup, in queue
 * order: only a recorded `LineupChanged` changes it, never a point (ADR 0027). `libero` is outside the
 * lineup and the bench, and `null` turns it off (ADR 0028).
 */
export interface TeamState {
  readonly bench: readonly MemberId[];
  readonly libero: TeamLibero | null;
  readonly lineup: readonly MemberId[];
  readonly setterZone: SetterZone;
  readonly system: FormationSystem;
}

/** `null` turns the rotation off for that team: a team without six players has it off. */
export interface TeamRotations {
  readonly a: TeamState | null;
  readonly b: TeamState | null;
}

export interface SetterZones {
  readonly a: SetterZone | null;
  readonly b: SetterZone | null;
}

/**
 * Who waits for the court, in order: whole teams first, then single players by arrival. A member is
 * in it once, and never in a team on the court (ADR 0029).
 */
export interface TeamQueue {
  readonly players: readonly MemberId[];
  readonly teams: readonly TeamRoster[];
}

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

/** Who stands where in a team: what a change of lineup records. `system` does not change. */
export type LineupAllocation = Pick<TeamState, "bench" | "libero" | "lineup" | "setterZone">;

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

export type ScorePayload =
  | MatchStartedPayload
  | PointScoredPayload
  | SetEndedPayload
  | MatchEndedPayload
  | LineupChangedPayload
  | QueueChangedPayload;

/** An open set. Named so it does not collide with the JavaScript `Set`. */
export interface MatchSet {
  readonly firstServer: TeamSide;
  readonly score: SetScore;
  readonly servingTeam: TeamSide;
  readonly setNumber: number;
  readonly targetPoints: number;
}

export interface CompletedMatchSet {
  readonly score: SetScore;
  readonly setNumber: number;
  readonly winner: TeamSide;
}

export interface MatchScore {
  readonly completedSets: readonly CompletedMatchSet[];
  readonly currentSet: MatchSet | null;
  readonly formationsVersion: number;
  readonly matchId: string;
  readonly rotations: TeamRotations;
  readonly rulesVersion: number;
  readonly scoring: ScoringRules;
  readonly setsWon: SetsWon;
  readonly teams: MatchTeams;
}

/** A match ended by hand keeps the set in progress in `currentSet`. */
export interface FinishedMatch extends MatchScore {
  readonly endReason: MatchEndReason;
  readonly winner: TeamSide | null;
}

/** `queue` is replaced by each event that records it, never accumulated (ADR 0029). */
export interface CourtSessionState {
  readonly currentMatch: MatchScore | null;
  readonly finishedMatches: readonly FinishedMatch[];
  readonly queue: TeamQueue;
}

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
  | "queue.players";

/** Carries only a path from the schema, never a received key or value. */
export interface ScorePayloadError {
  readonly code: "invalid-payload";
  readonly field: ScorePayloadField;
}

export type ScoreRefusalCode =
  | "invalid-rotation-direction"
  | "lineup-unchanged"
  | "match-already-open"
  | "no-open-match"
  | "no-open-set"
  | "queue-unchanged"
  | "rotation-off"
  | "set-decided"
  | "set-not-decided"
  | "too-many-matches"
  | "unsupported-formations-version"
  | "unsupported-rules-version";

export type ScoreCommandError = ScorePayloadError | { readonly code: ScoreRefusalCode };

/** An event without an envelope: `eventId` and `sequence` come from outside the pure engine. */
export interface ScoreEventDraft {
  readonly type: ScoreEventType;
  readonly payload: ScorePayload;
}

/** `firstServer` is the toss of a deciding set: the pure engine has no randomness of its own. */
export interface ConfirmSetEndOptions {
  readonly firstServer?: TeamSide;
}

export type ScoreCommandResult = Result<readonly ScoreEventDraft[], ScoreCommandError>;

/** Which formation a zone of the lineup plays, and whether the pairs of that formation are swapped. */
export interface ZoneFormation {
  readonly formationKey: RotationKey;
  readonly swapPairs: boolean;
}

export interface ServeAlignmentSlot {
  readonly memberId: MemberId;
  readonly role: PlayerRole;
  readonly point: CourtPoint;
}

/**
 * Where a team stands at the moment of the serve. Only the slot the libero is in has the role `L`,
 * with the libero in it; with the libero off, or out of the court, no slot has it.
 */
export interface ServeAlignment {
  readonly system: FormationSystem;
  readonly setterZone: SetterZone;
  readonly formationKey: RotationKey;
  readonly phase: FormationPhase;
  readonly actingSetter: MemberId;
  readonly slots: Readonly<Record<RotationSlot, ServeAlignmentSlot>>;
}
