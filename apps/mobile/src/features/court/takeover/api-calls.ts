import type { ApiError } from "../../../services/api/api-error";
import type { ApiResult } from "../../../services/api/api-result";
import type { TakeoverFailure } from "./takeover.reducer";

/** A body of the server is untrusted: only an object (not `null`, not an array) is read further. */
export function isRecord(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A 429 of the `court-sync` policy is waited for, never sooner (ADR 0062), up to this many times. */
export const RATE_LIMIT_ATTEMPTS = 3;

const HTTP_FORBIDDEN = 403;
const HTTP_NOT_FOUND = 404;

/** Waits the `Retry-After` of a 429 or a 503 and asks again; the last answer is returned as it is. */
export async function withRetryAfter<T>(
  call: () => Promise<ApiResult<T>>,
  wait: (ms: number) => Promise<void>,
  attemptsLeft: number = RATE_LIMIT_ATTEMPTS,
): Promise<ApiResult<T>> {
  const result = await call();
  if (result.ok || attemptsLeft <= 1) return result;
  const { error } = result;
  if (error.kind !== "rate-limited" && error.kind !== "unavailable") return result;
  await wait(error.retryAfterMs);
  return withRetryAfter(call, wait, attemptsLeft - 1);
}

type PlainKind = Exclude<ApiError["kind"], "problem">;

/** The failures without a body to read: a closed table, so a new kind fails the build. */
const PLAIN_FAILURES: Readonly<Record<PlainKind, TakeoverFailure>> = {
  offline: "offline",
  "account-changed": "no-account",
  "session-expired": "no-account",
  "not-registered": "no-account",
  "too-large": "failed",
  "app-outdated": "failed",
  "rate-limited": "failed",
  unavailable: "failed",
  unexpected: "failed",
};

/** What screen 09a says about a failed call: a code from a closed list, never a server text. */
export function takeoverFailureOf(error: ApiError): TakeoverFailure {
  if (error.kind !== "problem") return PLAIN_FAILURES[error.kind];
  if (error.code === "matches.limit-reached") return "writers-limit";
  if (error.status === HTTP_FORBIDDEN) return "no-permission";
  return error.status === HTTP_NOT_FOUND ? "not-found" : "failed";
}
