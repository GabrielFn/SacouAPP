// Commands of the score: refusals, drafts of events and results.
import type { Result } from "@sacou/volley-rules";

import type { ScoreEventType, ScorePayload, ScorePayloadError } from "./payloads.js";
import type { TeamSide } from "./team.js";

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
