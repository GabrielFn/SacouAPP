// State of the court session: sets, score, finished matches and the serve alignment.
import type {
  CourtPoint,
  FormationPhase,
  FormationSystem,
  PlayerRole,
  RotationKey,
  RotationSlot,
  SetterZone,
} from "@sacou/volley-rules";

import type {
  MatchEndReason,
  MatchTeams,
  MemberId,
  ScoringRules,
  TeamQueue,
  TeamRotations,
  TeamSide,
} from "./team.js";

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
