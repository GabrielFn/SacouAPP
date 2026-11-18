import type {
  AttributionRefusalCode,
  CorrectionRefusalCode,
  ScoreCommandError,
} from "@sacou/match-engine";

import type { CourtLogErrorCode } from "../ports/court-event-log";

export type CommandRefusalReason =
  ScoreCommandError["code"] | CorrectionRefusalCode | AttributionRefusalCode;

/** Why a command did not reach the log. Carries codes only, never a value of the log. */
export type CommandError =
  /** The engine refused the command: nothing happened, and the screen says why. */
  | { readonly code: "refused"; readonly reason: CommandRefusalReason }
  /** The command would have made the log fail to replay: it was not written. */
  | { readonly code: "rejected" }
  | { readonly code: "write-failed"; readonly cause: CourtLogErrorCode }
  | { readonly code: "not-ready" };

export type LoadFailureCode = CourtLogErrorCode | "replay-failed";
