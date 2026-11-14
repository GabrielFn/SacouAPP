import type { Result } from "@sacou/volley-rules";

import type {
  TeamQueue,
  CourtSessionState,
  MatchTeams,
  MemberId,
  ScorePayloadError,
  TeamRotations,
  TeamSide,
} from "../score/types.js";
import type { QUEUE_EXIT_CRITERION_KEYS, QUEUE_EXIT_MODE_KINDS } from "./constants.data.js";

export type QueueExitCriterionKey = (typeof QUEUE_EXIT_CRITERION_KEYS)[number];

export type QueueExitModeKind = (typeof QUEUE_EXIT_MODE_KINDS)[number];

/** Who leaves the losing team (`queue.exitMode`); `count` goes from 1 to 24 (ADR 0050). */
export type QueueExitMode =
  | { readonly kind: "automatic" }
  | { readonly kind: "whole-team" }
  | { readonly kind: "fixed-count"; readonly count: number };

/** "Vencedor também sai": the winner leaves too after `wins` wins in a row, from 1 to 10. */
export interface WinnerExit {
  readonly wins: number;
}

/**
 * What each criterion needs from outside the pure engine: the arrival order comes from the round
 * (E3), and the draw comes already shuffled, because the engine has no randomness (ADR 0024).
 */
export interface QueueExitCriterionInputs {
  readonly "consecutive-matches": { readonly arrivalOrder: readonly MemberId[] };
  readonly "arrival-order": { readonly arrivalOrder: readonly MemberId[] };
  readonly draw: { readonly drawOrder: readonly MemberId[] };
  readonly manual: { readonly chosen: readonly MemberId[] };
}

/** The criterion and its input, correlated by the key. */
export type QueueExitChoice<K extends QueueExitCriterionKey = QueueExitCriterionKey> = {
  readonly [P in K]: {
    readonly criterion: P;
    readonly criterionInput: QueueExitCriterionInputs[P];
  };
}[K];

/**
 * The criterion with the input for each team: `criterionInput` for the loser and
 * `winnerCriterionInput` for the winner who leaves too (`null` when the group does not use it).
 */
export type QueueExitChoices<K extends QueueExitCriterionKey = QueueExitCriterionKey> = {
  readonly [P in K]: QueueExitChoice<P> & {
    readonly winnerCriterionInput: QueueExitCriterionInputs[P] | null;
  };
}[K];

/**
 * Everything comes from the resolved settings (ADR 0017) and never goes into an event: the next
 * `MatchStarted` records the result (ADR 0050).
 */
export type NextMatchInput = QueueExitChoices & {
  readonly exitMode: QueueExitMode;
  readonly playersPerTeam: number;
  readonly winnerExit: WinnerExit | null;
};

/** Who of the losing team may leave, how many leave, and the round so far. */
export interface QueueExitCandidates {
  readonly count: number;
  readonly memberIds: readonly MemberId[];
  readonly state: CourtSessionState;
}

/**
 * The Strategy `IQueueExitCriterion` (`decisoes.md:28`): the members who leave, `count` of them, in
 * the order of the criterion; `null` when the input does not allow a choice. The input is read as
 * received, because the screen or a hostile caller may send anything (`QueueExitCriterionInputs`
 * is what a valid one holds).
 */
export interface QueueExitCriterion {
  readonly choose: (candidates: QueueExitCandidates, input: object) => readonly MemberId[] | null;
}

/** The criterion of the group with the input of one side: the loser's or the winner's. */
export interface QueueSideChoice {
  readonly criterion: QueueExitCriterionKey;
  readonly criterionInput: unknown;
}

/**
 * Where the member who leaves was, and so where the one who comes in stands: an index of `lineup`
 * or of `bench`, the libero, or an index of `teams.<side>.memberIds` with the rotation off.
 */
export type PartialExitPlace =
  | { readonly area: "lineup"; readonly index: number }
  | { readonly area: "bench"; readonly index: number }
  | { readonly area: "libero" }
  | { readonly area: "team"; readonly index: number };

export interface PartialExit {
  readonly consecutiveMatches: number;
  readonly incoming: MemberId;
  readonly outgoing: MemberId;
  readonly place: PartialExitPlace;
  readonly side: TeamSide;
}

/** The winner that leaves too, and the wins in a row that made it leave. */
export interface WinnerLeaving {
  readonly side: TeamSide;
  readonly streak: number;
}

/**
 * The next match the queue proposes: what screen 11 shows, and what "Confirmar" hands to
 * `startMatch`. `enteringTeams` are the sides a new team comes into (`a` before `b`), with the
 * rotation off for E4.7 to set; `exits` are the partial exits, side `a` first and then in the order
 * of the team; `winnerLeaving` says the winner left too.
 */
export interface NextMatchPlan {
  readonly enteringTeams: readonly TeamSide[];
  readonly exits: readonly PartialExit[];
  readonly queue: TeamQueue;
  readonly rotations: TeamRotations;
  readonly teams: MatchTeams;
  readonly winnerLeaving: WinnerLeaving | null;
}

export type QueueRefusalCode =
  | "invalid-exit-choice"
  | "invalid-exit-mode"
  | "invalid-players-per-team"
  | "invalid-winner-exit"
  | "match-already-open"
  | "no-finished-match";

export type QueueCommandError = ScorePayloadError | { readonly code: QueueRefusalCode };

export type NextMatchResult = Result<NextMatchPlan, QueueCommandError>;
