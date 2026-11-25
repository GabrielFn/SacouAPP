import type { EventEnvelope } from "@sacou/match-engine";

import type { ApiErrorCode } from "../../../api/generated/error-codes";
import type { ApiError, ProblemDetails } from "../../../services/api/api-error";
import type { ApiResult } from "../../../services/api/api-result";
import type { AppendCourtEventsAnswer } from "../../../services/api/sacou-api";
import type { SyncHaltCode, TakeOverNotice } from "../ports/court-event-log";

/** What the loop does with one answer of the server (ADR 0067, D4), decided here and nowhere else. */
export type SyncDecision =
  | { readonly type: "acknowledge"; readonly sequence: number }
  /** The server lost events it had confirmed: the cursor goes back and they are sent again. */
  | { readonly type: "rewind"; readonly sequence: number }
  | { readonly type: "take-over"; readonly notice: TakeOverNotice }
  /** A 422 inside the request: the valid events before the refused one go first, then the halt. */
  | { readonly type: "send-prefix"; readonly count: number }
  | { readonly type: "halt"; readonly code: SyncHaltCode }
  /** A 413: the same events again, in requests of half the size. */
  | { readonly type: "shrink" }
  | { readonly type: "retry"; readonly afterMs: number | null }
  /** Another account is signed in now: nothing was sent, and nothing changes in the log. */
  | { readonly type: "account-changed" };

/** The request and the log it came from: enough to judge every answer. */
export interface SentRequest {
  readonly chunk: readonly EventEnvelope[];
  /** The batch this device writes and the cursor before the request. */
  readonly batch: number;
  readonly ackedSequence: number;
  /** The highest sequence of this device in the log. */
  readonly lastOwnSequence: number;
}

const HTTP_BAD_REQUEST = 400;
const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;
const HTTP_UNPROCESSABLE = 422;

const BACKOFF: SyncDecision = { type: "retry", afterMs: null };
const DIVERGED: SyncDecision = { type: "halt", code: "stream-diverged" };

const halt = (code: SyncHaltCode): SyncDecision => ({ type: "halt", code });

function lastOf(chunk: readonly EventEnvelope[]): number {
  return chunk.at(-1)?.sequence ?? 0;
}

function acknowledged(answer: AppendCourtEventsAnswer, sent: SentRequest): SyncDecision {
  const { lastSequence } = answer;
  // The server holds at least what was sent and never more than this device wrote.
  const plausible =
    Number.isSafeInteger(lastSequence) &&
    lastSequence >= lastOf(sent.chunk) &&
    lastSequence <= sent.lastOwnSequence;
  return plausible ? { type: "acknowledge", sequence: lastSequence } : DIVERGED;
}

/**
 * The cursor only goes down, and it has to move: a gap at the cursor or above it is a server that
 * contradicts what it confirmed, and sending again at once would turn into a burst (ADR 0067, D4).
 * Two gaps in a row at the same sequence end here too: the first one left the cursor right there.
 */
function sequenceGap(details: ProblemDetails, sent: SentRequest): SyncDecision {
  const expected = details.expectedSequence;
  if (expected === undefined) return DIVERGED;
  const cursor = expected - 1;
  return cursor >= 0 && cursor < sent.ackedSequence
    ? { type: "rewind", sequence: cursor }
    : DIVERGED;
}

function notTheWriter(details: ProblemDetails, sent: SentRequest): SyncDecision {
  // Without `lastSequence` the pair never wrote a batch of this stream (ADR 0063, D8): nothing of this
  // device is there, so every local point is left out.
  const kept = Math.min(details.lastSequence ?? 0, sent.lastOwnSequence);
  const currentBatch = details.currentBatch ?? sent.batch + 1;
  return { type: "take-over", notice: { currentBatch, lastStoredSequence: kept } };
}

function refused(details: ProblemDetails, sent: SentRequest): SyncDecision {
  const index = sent.chunk.findIndex((event) => event.eventId === details.eventId);
  return index > 0 ? { type: "send-prefix", count: index } : halt("event-refused");
}

type ConflictRule = (details: ProblemDetails, sent: SentRequest) => SyncDecision;

/** The 409 of the stream by code; one not here (`batch-mismatch`, conflicts) means two writers. */
const CONFLICTS: Partial<Record<ApiErrorCode, ConflictRule>> = {
  "matches.sequence-gap": sequenceGap,
  "matches.not-the-writer": notTheWriter,
  // Another phone opened the court of this round first (answer 70): none of these events is there.
  "matches.round-has-court-session": (details, sent) => ({
    type: "take-over",
    notice: { currentBatch: details.currentBatch ?? sent.batch, lastStoredSequence: 0 },
  }),
  "matches.round-canceled": () => halt("round-canceled"),
};

function problem(
  status: number,
  code: ApiErrorCode,
  details: ProblemDetails,
  sent: SentRequest,
): SyncDecision {
  if (status === HTTP_UNPROCESSABLE) return refused(details, sent);
  if (status === HTTP_BAD_REQUEST) return halt("client-bug");
  if (status === HTTP_FORBIDDEN) return halt("no-permission");
  if (status === HTTP_NOT_FOUND) return halt("not-found");
  const conflict = CONFLICTS[code];
  return conflict === undefined ? DIVERGED : conflict(details, sent);
}

type PlainKind = Exclude<ApiError["kind"], "problem" | "rate-limited" | "unavailable">;

/** The answers without content to read. Nothing is lost by waiting: the events stay in the log. */
const PLAIN_DECISIONS: Readonly<Record<PlainKind, SyncDecision>> = {
  "too-large": { type: "shrink" },
  "account-changed": { type: "account-changed" },
  "session-expired": BACKOFF,
  "not-registered": BACKOFF,
  // An old build keeps its points in the log and sends them after the update (ADR 0084).
  "app-outdated": BACKOFF,
  offline: BACKOFF,
  unexpected: BACKOFF,
};

function failure(error: ApiError, sent: SentRequest): SyncDecision {
  if (error.kind === "problem") return problem(error.status, error.code, error.details ?? {}, sent);
  if (error.kind === "rate-limited" || error.kind === "unavailable") {
    return { type: "retry", afterMs: error.retryAfterMs };
  }
  return PLAIN_DECISIONS[error.kind];
}

/** The one table of what each answer means for the upload (D4). Pure: the runner does the effects. */
export function decideSync(
  result: ApiResult<AppendCourtEventsAnswer>,
  sent: SentRequest,
): SyncDecision {
  return result.ok ? acknowledged(result.value, sent) : failure(result.error, sent);
}
