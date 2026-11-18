import type { ApiError } from "../../../services/api/api-error";
import type { ApiResult } from "../../../services/api/api-result";
import type { TakeoverFailure } from "./takeover.reducer";

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

/** What screen 09a says about a failed call: a code from a closed list, never a server text. */
export function takeoverFailureOf(error: ApiError): TakeoverFailure {
  switch (error.kind) {
    case "problem":
      if (error.code === "matches.limit-reached") return "writers-limit";
      if (error.status === HTTP_FORBIDDEN) return "no-permission";
      if (error.status === HTTP_NOT_FOUND) return "not-found";
      return "failed";
    case "offline":
      return "offline";
    case "account-changed":
    case "session-expired":
    case "not-registered":
      return "no-account";
    case "too-large":
    case "rate-limited":
    case "unavailable":
    case "unexpected":
      return "failed";
  }
}
