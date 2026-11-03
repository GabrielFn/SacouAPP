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
  MATCH_ENDED_EVENT_TYPE,
  MATCH_STARTED_EVENT_TYPE,
  PAYLOAD_ROOT_FIELD,
  POINT_SCORED_EVENT_TYPE,
  SET_ENDED_EVENT_TYPE,
  TEAM_SIDES,
  UNKNOWN_PAYLOAD_FIELD,
  WIN_MARGIN_VALUES,
} from "./constants.data.js";

export type ScoreEventType =
  | typeof MATCH_STARTED_EVENT_TYPE
  | typeof POINT_SCORED_EVENT_TYPE
  | typeof SET_ENDED_EVENT_TYPE
  | typeof MATCH_ENDED_EVENT_TYPE;

/** A lowercase UUID. Where this type lives is decided in E3.2. */
export type MemberId = string;

export type TeamSide = (typeof TEAM_SIDES)[number];
export type BestOf = (typeof BEST_OF_VALUES)[number];
export type WinMargin = (typeof WIN_MARGIN_VALUES)[number];
export type MatchEndReason = (typeof END_REASONS)[number];

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
 * The part of a team that changes during a match; `teams` stays the frozen copy of the event.
 * `lineup` has six members anchored on the setter: `lineup[0]` is the setter and the others follow
 * in ascending position, so a rotation only changes `setterZone`. In the free system, which has no
 * setter, `setterZone` is the zone of the first member of the lineup. The order of the lineup also
 * gives each member a role: `S, OH1, MB1, OPP, OH2, MB2` in the 5x1 and `S1, OH1, MB1, S2, OH2, MB2`
 * in the 6x2 and the 4x2 (ADR 0026).
 */
export interface TeamState {
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

export interface MatchStartedPayload {
  readonly firstServer: TeamSide;
  readonly formationsVersion: number;
  readonly matchId: string;
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

export type ScorePayload =
  MatchStartedPayload | PointScoredPayload | SetEndedPayload | MatchEndedPayload;

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

export interface CourtSessionState {
  readonly currentMatch: MatchScore | null;
  readonly finishedMatches: readonly FinishedMatch[];
}

/** The key tree of a closed payload schema; `null` marks a leaf. */
export interface PayloadShape {
  readonly [key: string]: PayloadShape | null;
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
  | "rotations.b"
  | "rotations.b.lineup"
  | "rotations.b.setterZone"
  | "rotations.b.system"
  | "setNumber"
  | "team"
  | "winner"
  | "nextSet"
  | "nextSet.targetPoints"
  | "nextSet.firstServer"
  | "nextSet.setterZones"
  | "nextSet.setterZones.a"
  | "nextSet.setterZones.b"
  | "endReason";

/** Carries only a path from the schema, never a received key or value. */
export interface ScorePayloadError {
  readonly code: "invalid-payload";
  readonly field: ScorePayloadField;
}

export type ScoreRefusalCode =
  | "match-already-open"
  | "no-open-match"
  | "no-open-set"
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

/** Where a team stands at the moment of the serve, with the libero off: no slot has the role `L`. */
export interface ServeAlignment {
  readonly system: FormationSystem;
  readonly setterZone: SetterZone;
  readonly formationKey: RotationKey;
  readonly phase: FormationPhase;
  readonly actingSetter: MemberId;
  readonly slots: Readonly<Record<RotationSlot, ServeAlignmentSlot>>;
}
