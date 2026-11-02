import type { Result } from "@sacou/volley-rules";

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

export interface MatchStartedPayload {
  readonly matchId: string;
  readonly rulesVersion: number;
  readonly scoring: ScoringRules;
  readonly teams: MatchTeams;
}

/** Records no absolute score: two interleaved writers would otherwise lock the stream. */
export interface PointScoredPayload {
  readonly matchId: string;
  readonly setNumber: number;
  readonly team: TeamSide;
}

export interface NextSet {
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
  readonly score: SetScore;
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
  readonly matchId: string;
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
  | "setNumber"
  | "team"
  | "winner"
  | "nextSet"
  | "nextSet.targetPoints"
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
  | "unsupported-rules-version";

export type ScoreCommandError = ScorePayloadError | { readonly code: ScoreRefusalCode };

/** An event without an envelope: `eventId` and `sequence` come from outside the pure engine. */
export interface ScoreEventDraft {
  readonly type: ScoreEventType;
  readonly payload: ScorePayload;
}

export type ScoreCommandResult = Result<readonly ScoreEventDraft[], ScoreCommandError>;
