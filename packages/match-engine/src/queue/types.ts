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
import type { QUEUE_EXIT_CRITERION_KEYS } from "./constants.data.js";

export type QueueExitCriterionKey = (typeof QUEUE_EXIT_CRITERION_KEYS)[number];

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

/** `playersPerTeam` and the criterion come from the resolved settings (ADR 0017). */
export type NextMatchInput = QueueExitChoice & { readonly playersPerTeam: number };

/** Who of the losing team may leave, how many leave, and the round so far. */
export interface QueueExitCandidates {
  readonly count: number;
  readonly memberIds: readonly MemberId[];
  readonly state: CourtSessionState;
}

/**
 * The Strategy `IQueueExitCriterion` (`decisoes.md:28`): the members who leave, `count` of them, in
 * the order of the criterion; `null` when the input does not allow a choice.
 */
export interface QueueExitCriterion<I> {
  readonly choose: (candidates: QueueExitCandidates, input: I) => readonly MemberId[] | null;
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
}

/**
 * The next match the queue proposes: what screen 11 shows, and what "Confirmar" hands to
 * `startMatch`. `enteringTeam` is the side a whole team of the queue comes into, with its rotation
 * off for E4.7 to set; `exits` are the partial exits, in the order of the team.
 */
export interface NextMatchPlan {
  readonly enteringTeam: TeamSide | null;
  readonly exits: readonly PartialExit[];
  readonly queue: TeamQueue;
  readonly rotations: TeamRotations;
  readonly teams: MatchTeams;
}

export type QueueRefusalCode =
  "invalid-exit-choice" | "invalid-players-per-team" | "match-already-open" | "no-finished-match";

export type QueueCommandError = ScorePayloadError | { readonly code: QueueRefusalCode };

export type NextMatchResult = Result<NextMatchPlan, QueueCommandError>;
